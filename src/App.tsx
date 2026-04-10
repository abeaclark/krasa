import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { Packages } from "./components/Packages";
import { About } from "./components/About";
import { Contact } from "./components/Contact";
import { Footer } from "./components/Footer";

export default function App() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <Packages />
        <About />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
