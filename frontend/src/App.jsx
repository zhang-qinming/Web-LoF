import './App.css';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { FaHome, FaDna, FaListAlt, FaEnvelope, FaFolderOpen, FaInfoCircle } from 'react-icons/fa';
import HamburgerMenu from './components/HamburgerMenu.jsx';
import Home from './routes/Home.jsx';
import About from './routes/About.jsx';
import Contact from './routes/Contact.jsx';
import Trait from './routes/Trait.jsx';
import Genes from './routes/Genes.jsx';
import Variants from './routes/Variants.jsx';
import Browse from './routes/Browse.jsx';

function NotFound() {
    return <h1>404 - Page Not Found</h1>;
}

function App() {
    return (
        <BrowserRouter>
            <div className="app-container">
                <header className="header hidden-mobile">
                    <nav className="nav">
                        <NavLink to="/" className="nav-link"><FaHome /> Home</NavLink>
                        <NavLink to="/trait" className="nav-link"><FaListAlt /> Trait</NavLink>
                        <NavLink to="/genes" className="nav-link"><FaDna /> Genes</NavLink>
                        <NavLink to="/variants" className="nav-link"><FaDna /> Variants</NavLink>
                        <NavLink to="/browse" className="nav-link"><FaFolderOpen /> Browse</NavLink>
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
                        <Route path="/variants" element={<Variants />} />
                        <Route path="/browse" element={<Browse />} />
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
