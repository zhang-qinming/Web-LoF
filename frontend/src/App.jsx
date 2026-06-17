import './App.css';
import React, { Suspense } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { fetcher, getGenes, getHomeStats } from './api/gwas.js';
import MobileNavDrawer from './components/MobileNavDrawer.jsx';
import NavIcon from './components/NavIcons.jsx';
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
    { to: '/', icon: <NavIcon name="home" />, label: 'Home' },
    { to: '/genes', icon: <NavIcon name="genes" />, label: 'Genes' },
    { to: '/programs', icon: <NavIcon name="programs" />, label: 'Programs' },
    { to: '/trait', icon: <NavIcon name="trait" />, label: 'Trait' },
    { to: '/data', icon: <NavIcon name="data" />, label: 'Data' },
    { to: '/help', icon: <NavIcon name="guide" />, label: 'Guide' },
    { to: '/contact', icon: <NavIcon name="contact" />, label: 'Contact' },
    { to: '/about', icon: <NavIcon name="about" />, label: 'About' },
];

const routePreloaders = {
    '/about': () => import('./routes/About.jsx'),
    '/contact': () => import('./routes/Contact.jsx'),
    '/help': () => import('./routes/Help.jsx'),
    '/trait': loadTraitRoute,
    '/genes': loadGenesRoute,
    '/data': loadVariantsRoute,
    '/programs': loadProgramsRoute,
};
const preloadedRoutes = new Set();

function loadTraitRoute() { return import('./routes/Trait.jsx'); }
function loadGenesRoute() { return import('./routes/Genes.jsx'); }
function loadVariantsRoute() { return import('./routes/Variants.jsx'); }
function loadProgramsRoute() { return import('./routes/Programs.jsx'); }

function preloadRoute(path) {
    const loader = routePreloaders[path];
    if (!loader || preloadedRoutes.has(path)) return;
    preloadedRoutes.add(path);
    loader().catch(() => {
        preloadedRoutes.delete(path);
    });
}

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

    React.useEffect(() => {
        const frameId = window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        });

        return () => window.cancelAnimationFrame(frameId);
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

function scheduleIdleTask(callback, timeout = 1600) {
    if (typeof window === 'undefined') return () => {};
    if ('requestIdleCallback' in window) {
        const idleId = window.requestIdleCallback(callback, { timeout });
        return () => window.cancelIdleCallback(idleId);
    }
    const timerId = window.setTimeout(callback, Math.min(timeout, 600));
    return () => window.clearTimeout(timerId);
}

function App() {
    const { mutate } = useSWRConfig();

    React.useEffect(() => {
        const queue = [
            () => mutate('/api/home/stats', getHomeStats(), { revalidate: false, populateCache: true }),
            () => mutate('/api/programs/info', fetcher('/api/programs/info'), { revalidate: false, populateCache: true }),
            () => mutate('/api/browse?page=1&limit=25&sortBy=trait_name&order=ASC', fetcher('/api/browse?page=1&limit=25&sortBy=trait_name&order=ASC'), { revalidate: false, populateCache: true }),
            () => mutate(['gene-index', 0, 25, 'totalTraits', 'desc', ''], getGenes({ page: 1, limit: 25, sortBy: 'totalTraits', order: 'desc', search: '' }), { revalidate: false, populateCache: true }),
        ];
        let cancelled = false;
        let cancelIdle = () => {};
        const preloadNext = () => {
            if (cancelled || queue.length === 0) return;
            cancelIdle = scheduleIdleTask(() => {
                const task = queue.shift();
                task?.().catch(() => {});
                preloadNext();
            });
        };
        preloadNext();
        return () => {
            cancelled = true;
            cancelIdle();
        };
    }, [mutate]);

    return (
        <BrowserRouter>
            <ScrollToTopOnPathChange />
            <div className="app-container">
                <header className="header hidden-mobile">
                    <nav className="nav">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className="nav-link"
                                onMouseEnter={() => preloadRoute(link.to)}
                                onFocus={() => preloadRoute(link.to)}
                            >
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
