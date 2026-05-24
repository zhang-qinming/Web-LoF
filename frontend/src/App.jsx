import './App.css';
import React, { Suspense } from 'react';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { FaHome, FaDna, FaListAlt, FaEnvelope, FaInfoCircle, FaProjectDiagram, FaFolderOpen } from 'react-icons/fa';
import HamburgerMenu from './components/HamburgerMenu.jsx';

const Home = React.lazy(() => import('./routes/Home.jsx'));
const About = React.lazy(() => import('./routes/About.jsx'));
const Contact = React.lazy(() => import('./routes/Contact.jsx'));
const Trait = React.lazy(() => import('./routes/Trait.jsx'));
const Genes = React.lazy(() => import('./routes/Genes.jsx'));
const Variants = React.lazy(() => import('./routes/Variants.jsx'));
const Programs = React.lazy(() => import('./routes/Programs.jsx'));

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
                    <Suspense fallback={<div className="route-loading">Loading...</div>}>
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
                    </Suspense>
                    <footer className="footer">
                        &copy; {new Date().getFullYear()}
                    </footer>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
