import './App.css';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { FaHome, FaDna, FaListAlt, FaEnvelope, FaInfoCircle, FaProjectDiagram, FaFolderOpen } from 'react-icons/fa';
import HamburgerMenu from './components/HamburgerMenu.jsx';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Contact from './routes/Contact.jsx';
import Trait from './routes/Trait.jsx';
import Genes from './routes/Genes.jsx';
import Variants from './routes/Variants.jsx';
import Programs from './routes/Programs.jsx';

function NotFound() {
    return (
        <div className="not-found">
            <h1>404</h1>
            <p>Page not found</p>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <div className="app-container">
                <header className="header hidden-mobile">
                    <nav className="nav">
                        <NavLink to="/" className="nav-link"><FaHome /> Home</NavLink>
                        <NavLink to="/trait" className="nav-link"><FaListAlt /> Trait</NavLink>
                        <NavLink to="/programs" className="nav-link"><FaProjectDiagram /> Programs</NavLink>
                        <NavLink to="/genes" className="nav-link"><FaDna /> Genes</NavLink>
                        <NavLink to="/data" className="nav-link"><FaFolderOpen /> Data</NavLink>
                        <NavLink to="/contact" className="nav-link"><FaEnvelope /> Contact</NavLink>
                        <NavLink to="/about" className="nav-link"><FaInfoCircle /> About</NavLink>
                    </nav>
                </header>
                <div className="mobile-header visible-mobile">
                    <HamburgerMenu />
                </div>
                <main className="main">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/trait" element={<Trait />} />
                        <Route path="/trait/:traitName" element={<Trait />} />
                        <Route path="/genes" element={<Genes />} />
                        <Route path="/data" element={<Variants />} />
                        <Route path="/programs" element={<Programs />} />
                        <Route path="/programs/:programId" element={<Programs />} />
                        <Route path="*" element={<NotFound />} />
                    </Routes>
                    <footer className="footer">
                        &copy; {new Date().getFullYear()}
                    </footer>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
