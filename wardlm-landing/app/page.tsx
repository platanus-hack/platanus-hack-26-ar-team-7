import Header from "./components/header";
import Hero from "./components/hero";
import Incidents from "./components/incidents";
import Architecture from "./components/architecture";
import Install from "./components/install";
import Team from "./components/team";
import Footer from "./components/footer";

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Incidents />
        <Architecture />
        <Install />
        <Team />
      </main>
      <Footer />
    </>
  );
}
