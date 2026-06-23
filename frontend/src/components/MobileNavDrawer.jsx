import React from 'react';
import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';
import CloseRounded from '@mui/icons-material/CloseRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';

const drawerWidth = 280;
const buttonSize = 42;
const edgeGap = 8;
const dragThreshold = 6;

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function getViewport() {
    return {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
    };
}

export default function MobileNavDrawer({ links }) {
    const theme = useTheme();
    const [open, setOpen] = React.useState(false);
    const [position, setPosition] = React.useState({ x: edgeGap, y: edgeGap });
    const [dock, setDock] = React.useState('left');
    const [dragging, setDragging] = React.useState(false);
    const pointerRef = React.useRef({
        active: false,
        moved: false,
        startX: 0,
        startY: 0,
        offsetX: 0,
        offsetY: 0,
    });
    const buttonRef = React.useRef(null);

    const toggle = (next) => () => setOpen(next);
    const drawerAnchor = dock === 'left' ? 'right' : 'left';

    React.useEffect(() => {
        const handleResize = () => {
            const viewport = getViewport();
            setPosition((current) => ({
                x: dock === 'right'
                    ? Math.max(edgeGap, viewport.width - buttonSize - edgeGap)
                    : edgeGap,
                y: clamp(current.y, edgeGap, viewport.height - buttonSize - edgeGap),
            }));
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [dock]);

    const handlePointerDown = (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
            active: true,
            moved: false,
            startX: event.clientX,
            startY: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
        };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const handlePointerMove = (event) => {
        if (!pointerRef.current.active) return;

        const deltaX = event.clientX - pointerRef.current.startX;
        const deltaY = event.clientY - pointerRef.current.startY;
        if (!pointerRef.current.moved && Math.hypot(deltaX, deltaY) < dragThreshold) return;

        pointerRef.current.moved = true;
        setDragging(true);

        const viewport = getViewport();
        setPosition({
            x: clamp(event.clientX - pointerRef.current.offsetX, edgeGap, viewport.width - buttonSize - edgeGap),
            y: clamp(event.clientY - pointerRef.current.offsetY, edgeGap, viewport.height - buttonSize - edgeGap),
        });
    };

    const finishDrag = (event) => {
        if (!pointerRef.current.active) return;

        event.currentTarget.releasePointerCapture?.(event.pointerId);
        pointerRef.current.active = false;

        if (!pointerRef.current.moved) {
            setDragging(false);
            return;
        }

        const viewport = getViewport();
        setPosition((current) => {
            const nextDock = current.x + (buttonSize / 2) <= viewport.width / 2 ? 'left' : 'right';
            setDock(nextDock);
            return {
                x: nextDock === 'left' ? edgeGap : viewport.width - buttonSize - edgeGap,
                y: clamp(current.y, edgeGap, viewport.height - buttonSize - edgeGap),
            };
        });
        window.setTimeout(() => setDragging(false), 0);
    };

    const handleButtonClick = () => {
        if (pointerRef.current.moved) {
            pointerRef.current.moved = false;
            return;
        }
        setOpen(true);
    };

    return (
        <>
            <IconButton
                ref={buttonRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finishDrag}
                onPointerCancel={finishDrag}
                onClick={handleButtonClick}
                aria-label="Open navigation"
                sx={{
                    position: 'fixed',
                    left: position.x,
                    top: position.y,
                    zIndex: 1301,
                    width: 42,
                    height: 42,
                    borderRadius: 1.5,
                    border: `1px solid ${theme.custom.border.soft}`,
                    backgroundColor: alpha(theme.palette.common.white, 0.84),
                    boxShadow: theme.custom.shadow.panel,
                    color: theme.palette.text.primary,
                    cursor: dragging ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    transition: dragging ? 'none' : `left ${theme.custom.motion.swift}, top ${theme.custom.motion.swift}, background-color ${theme.custom.motion.swift}, box-shadow ${theme.custom.motion.swift}`,
                    '&:hover': {
                        backgroundColor: theme.palette.common.white,
                    },
                }}
            >
                <MenuRounded sx={{ fontSize: 18 }} />
            </IconButton>
            <Drawer
                anchor={drawerAnchor}
                open={open}
                onClose={toggle(false)}
                PaperProps={{
                    sx: {
                        width: drawerWidth,
                        p: 1.25,
                        backgroundColor: theme.custom.surface.base,
                    },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.6 }}>
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            TraitCircuit
                        </Typography>
                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            Program-centric human genetics
                        </Typography>
                    </Box>
                    <IconButton onClick={toggle(false)} aria-label="Close navigation" size="small">
                        <CloseRounded sx={{ fontSize: 18 }} />
                    </IconButton>
                </Box>
                <Divider sx={{ my: 1 }} />
                <List disablePadding sx={{ display: 'grid', gap: 0.4 }}>
                    {links.map((link) => (
                        <ListItemButton
                            key={link.to}
                            component={NavLink}
                            to={link.to}
                            onClick={toggle(false)}
                            sx={{
                                borderRadius: 1.5,
                                px: 1.25,
                                py: 0.95,
                                color: theme.palette.text.secondary,
                                '&.active': {
                                    backgroundColor: alpha(theme.palette.primary.main, 0.1),
                                    color: theme.palette.primary.dark,
                                    '& .MuiListItemIcon-root': {
                                        color: theme.palette.primary.main,
                                    },
                                    '& .MuiTypography-root': {
                                        fontWeight: 700,
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                                {link.icon}
                            </ListItemIcon>
                            <ListItemText primary={link.label} primaryTypographyProps={{ fontSize: '0.92rem', fontWeight: 600 }} />
                        </ListItemButton>
                    ))}
                </List>
            </Drawer>
        </>
    );
}
