import './App.css';
import React, { Suspense } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
    FaDna,
    FaEnvelope,
    FaFolderOpen,
    FaHome,
    FaInfoCircle,
    FaListAlt,
    FaProjectDiagram,
    FaQuestionCircle,
} from 'react-icons/fa';
import MobileNavDrawer from './components/MobileNavDrawer.jsx';
import { StatePanel } from './components/PageScaffold.jsx';

import Home from './routes/Home.jsx';
const About = React.lazy(() => import('./routes/About.jsx'));
const Contact = React.lazy(() => import('./routes/Contact.jsx'));
const Help = React.lazy(() => import('./routes/Help.jsx'));
const Trait = React.lazy(() => import('./routes/Trait.jsx'));
const Genes = React.lazy(() => import('./routes/Genes.jsx'));
const Variants = React.lazy(() => import('./routes/Variants.jsx'));
const Programs = React.lazy(() => import('./routes/Programs.jsx'));

const navLinks = [
    { to: '/', icon: <FaHome />, label: 'Home' },
    { to: '/genes', icon: <FaDna />, label: 'Genes' },
    { to: '/programs', icon: <FaProjectDiagram />, label: 'Programs' },
    { to: '/trait', icon: <FaListAlt />, label: 'Trait' },
    { to: '/data', icon: <FaFolderOpen />, label: 'Data' },
    { to: '/help', icon: <FaQuestionCircle />, label: 'Guide' },
    { to: '/contact', icon: <FaEnvelope />, label: 'Contact' },
    { to: '/about', icon: <FaInfoCircle />, label: 'About' },
];

function NotFound() {
    return (
        <StatePanel
            severity="warning"
            title="Page not found"
            message="The requested route does not exist in this browser."
            minHeight={360}
        />
    );
}

function ScrollToTopOnPathChange() {
    const { pathname } = useLocation();

    React.useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [pathname]);

    return null;
}

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <div key={location.pathname} className="route-transition">
            <Suspense
                fallback={(
                    <StatePanel
                        loading
                        title="Loading view"
                        message="Preparing the requested browser panel."
                        minHeight={320}
                    />
                )}
            >
                <Routes location={location}>
                    <Route path="/" element={<Home />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/trait" element={<Trait />} />
                    <Route path="/trait/:traitName" element={<Trait />} />
                    <Route path="/genes" element={<Genes />} />
                    <Route path="/data" element={<Variants />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/programs" element={<Programs />} />
                    <Route path="/programs/:programId" element={<Programs />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </Suspense>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <ScrollToTopOnPathChange />
            <div className="app-container">
                <header className="header hidden-mobile">
                    <nav className="nav">
                        {navLinks.map((link) => (
                            <NavLink key={link.to} to={link.to} className="nav-link">
                                {link.icon} {link.label}
                            </NavLink>
                        ))}
                    </nav>
                </header>
                <div className="mobile-header visible-mobile">
                    <MobileNavDrawer links={navLinks} />
                </div>
                <main className="main">
                    <AnimatedRoutes />
                    <footer className="footer">
                        &copy; {new Date().getFullYear()}
                    </footer>
                </main>
            </div>
        </BrowserRouter>
    );
}

export default App;
