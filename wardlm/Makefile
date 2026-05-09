CC       ?= gcc
CFLAGS   ?= -O2 -Wall -Wextra
LDLIBS   ?= -lcurl
TARGET    = wardlm

PREFIX   ?= /opt/wardlm
BINDIR    = $(PREFIX)/bin
SHIMDIR   = $(PREFIX)/shim
LOGDIR   ?= /var/log/wardlm

SRC := $(wildcard src/*.c)
OBJ := $(SRC:.c=.o)

all: $(TARGET)

$(TARGET): $(OBJ)
	$(CC) $(CFLAGS) -o $@ $^ $(LDLIBS)

%.o: %.c
	$(CC) $(CFLAGS) -c $< -o $@

install: $(TARGET)
	install -d $(DESTDIR)$(BINDIR) $(DESTDIR)$(SHIMDIR)
	install -m 0755 $(TARGET) $(DESTDIR)$(BINDIR)/$(TARGET)
	install -m 0755 shim/* $(DESTDIR)$(SHIMDIR)/
	install -d -m 1777 $(DESTDIR)$(LOGDIR)

clean:
	rm -f $(TARGET) src/*.o

.PHONY: all install clean
