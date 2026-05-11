// src/components/HamburgerMenu.jsx
/**
 * 汉堡悬浮按钮 + 抽屉菜单组件
 *
 * 功能与特点：
 * - 按钮可在视口内拖拽，松手后自动吸附到左右边缘（dock）。
 * - 菜单根据吸附侧从相反方向展开，避免遮挡按钮。
 * - 使用 requestAnimationFrame 合并位移更新，减少重排与抖动。
 * - 使用 Pointer 事件统一鼠标/触屏交互，支持 pointer capture。
 * - 关闭菜单带有轻量退出动画（isClosing）。
 *
 * 重要约束：
 * - 按钮 transform 位移由 JS 控制，样式位置固定为 fixed(top:0,left:0)。
 */

import React, {useCallback, useEffect, useRef, useState} from "react";
import {NavLink} from "react-router-dom";
import {
    FaHome, FaDna, FaListAlt, FaEnvelope,
    FaInfoCircle, FaProjectDiagram, FaFolderOpen,
} from 'react-icons/fa';

const navLinks = [
    {to: '/', icon: <FaHome />, label: 'Home'},
    {to: '/trait', icon: <FaListAlt />, label: 'Trait'},
    {to: '/programs', icon: <FaProjectDiagram />, label: 'Programs'},
    {to: '/genes', icon: <FaDna />, label: 'Genes'},
    {to: '/data', icon: <FaFolderOpen />, label: 'Data'},
    {to: '/contact', icon: <FaEnvelope />, label: 'Contact'},
    {to: '/about', icon: <FaInfoCircle />, label: 'About'},
];

export default function HamburgerMenu() {
    const [isOpen, setIsOpen] = useState(false);  // 菜单是否打开
    const [isClosing, setIsClosing] = useState(false); // 退出动画进行中（true 时渲染中但带 closing 类，动画结束后真正隐藏）
    const [dragging, setDragging] = useState(false);    // 是否为“拖拽中”状态（仅用于样式与逻辑判断）
    const [dock, setDock] = useState("left");    // 按钮贴靠侧：'left' | 'right'
    const [pulse, setPulse] = useState(false);    // 点击按钮的轻微脉冲动效
    // 悬浮按钮 DOM 引用
    const btnRef = useRef(null);

    // 以下 refs 保存位置信息和交互状态，避免频繁触发重渲染：
    const posRef = useRef({x: 0, y: 0});      // 当前按钮左上角的位移（相对 fixed 原点）
    const sizeRef = useRef({w: 40, h: 40});   // 按钮尺寸（用于边界/吸附计算）
    const startRef = useRef({x: 0, y: 0});    // 指针按下的起始坐标（用于阈值判断）
    const offsetRef = useRef({dx: 0, dy: 0}); // 指针相对按钮左上角的偏移
    const movedRef = useRef(false);             // 本次按下期间是否发生过移动
    const isDownRef = useRef(false);            // 指针是否处于按下状态
    const frameRef = useRef(0);                 // rAF 帧句柄，便于取消

    // 拖拽边距（留白），以及从“点击”判定为“拖拽”的距离阈值
    const margin = 0;
    const DRAG_THRESHOLD = 6;

    // 获取视口宽高（避免 window.innerWidth 包含滚动条）
    const viewportSize = () => {
        const vw = document.documentElement.clientWidth;
        const vh = document.documentElement.clientHeight;
        return {vw, vh};
    };

    // 将按钮按照 (x,y) 位移到目标位置（仅写 transform，不触发布局）
    const applyTransform = useCallback((x, y) => {
        const el = btnRef.current;
        if (!el) return;
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }, []);

    // 使用 rAF 合并多次位置更新，避免一帧内多次强制样式计算
    const scheduleApply = useCallback(() => {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = requestAnimationFrame(() => {
            applyTransform(posRef.current.x, posRef.current.y);
        });
    }, [applyTransform]);

    // 初始化：测量按钮尺寸；在窗口大小变化时，确保按钮仍在可视范围内
    useEffect(() => {
        const el = btnRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        sizeRef.current = {w: rect.width || 40, h: rect.height || 40};
        applyTransform(posRef.current.x, posRef.current.y);

        const onResize = () => {
            const {vw, vh} = viewportSize();
            const {w, h} = sizeRef.current;
            // 视口变化时，钳制位置，防止按钮被挤出屏幕
            posRef.current = {
                x: Math.min(Math.max(margin, posRef.current.x), vw - w - margin),
                y: Math.min(Math.max(margin, posRef.current.y), vh - h - margin),
            };
            scheduleApply();
        };
        window.addEventListener("resize", onResize);
        return () => {
            window.removeEventListener("resize", onResize);
            cancelAnimationFrame(frameRef.current);
        };
    }, [applyTransform, scheduleApply]);

    // 打开菜单（无动画）
    const openMenu = () => setIsOpen(true);

    // 请求关闭菜单：先加 closing 类触发过渡动画，稍后再真正隐藏
    const requestCloseMenu = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsOpen(false);
            setIsClosing(false);
        }, 160); // 对齐 CSS 过渡时长
    };

    // 指针按下：记录起点、相对偏移；开启 pointer capture 保持事件流
    const onPointerDown = (e) => {
        const el = btnRef.current;
        if (!el) return;
        isDownRef.current = true;
        movedRef.current = false;
        setDragging(false);

        el.setPointerCapture?.(e.pointerId);

        const rect = el.getBoundingClientRect();
        sizeRef.current = {w: rect.width, h: rect.height};

        startRef.current = {x: e.clientX, y: e.clientY};
        offsetRef.current = {dx: e.clientX - rect.left, dy: e.clientY - rect.top};
    };

    // 指针移动：超过阈值后进入拖拽，限制在视口内，按位移更新
    const onPointerMove = (e) => {
        if (!isDownRef.current) return;
        const el = btnRef.current;
        if (!el) return;

        const {dx, dy} = offsetRef.current;
        const {w, h} = sizeRef.current;
        const {vw, vh} = viewportSize();

        // 计算钳制后的目标位置（确保按钮不出界）
        const x = Math.min(Math.max(margin, e.clientX - dx), vw - w - margin);
        const y = Math.min(Math.max(margin, e.clientY - dy), vh - h - margin);

        // 仅当移动距离超过阈值才认为是拖拽，以避免“点击抖动”
        if (!dragging) {
            const mx = e.clientX - startRef.current.x;
            const my = e.clientY - startRef.current.y;
            if (Math.hypot(mx, my) > DRAG_THRESHOLD) {
                setDragging(true);
                // will-change 提示浏览器优化 transform 动画
                el.style.willChange = "transform";
            } else {
                return;
            }
        }

        movedRef.current = true;
        posRef.current = {x, y};
        scheduleApply();
    };

    // 指针抬起：若处于拖拽，则进行左右吸附；否则可能是点击
    const onPointerUp = (e) => {
        const el = btnRef.current;
        el?.releasePointerCapture?.(e.pointerId);
        isDownRef.current = false;

        if (dragging) {
            setDragging(false);
            const {w} = sizeRef.current;
            const {vw} = viewportSize();
            const mid = vw / 2;
            // 按钮中心点在中线左侧 => 吸附左边；否则吸附右边
            const snapToLeft = posRef.current.x + w / 2 <= mid;

            posRef.current = {
                x: snapToLeft ? margin : vw - w - margin,
                y: posRef.current.y,
            };
            setDock(snapToLeft ? "left" : "right");

            if (el) el.style.willChange = "auto";
            scheduleApply();
        }
    };

    // 点击按钮：若本次操作发生过拖拽/移动，则忽略点击；否则切换菜单
    const onButtonClick = () => {
        if (dragging || movedRef.current) return;
        // 轻量脉冲动效
        setPulse(true);
        setTimeout(() => setPulse(false), 180);
        // 根据当前状态开/关菜单（关闭时带过渡）
        if (isOpen || isClosing) requestCloseMenu();
        else openMenu();
    };

    // 贴左 => 菜单在右侧展开；贴右 => 菜单在左侧展开（避免遮挡按钮）
    const navSideClass = dock === "left" ? "side-right" : "side-left";
    // 仅在打开或关闭动画中才渲染菜单容器
    const shouldRenderMenu = isOpen || isClosing;

    return (
        <>
            <button
                ref={btnRef}
                className={`hamburger-btn ${dragging ? 'dragging' : ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onClick={onButtonClick}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={isOpen}
                aria-controls="hamburger-nav"
                style={{position: 'fixed', top: 0, left: 0, zIndex: 200}}
            >
                <span className={`hamburger-btn-inner ${pulse ? "pulse" : ""}`}>☰</span>
            </button>

            {shouldRenderMenu && (
                <div
                    className={`hamburger-overlay${isClosing ? " closing" : ""}`}
                    onClick={requestCloseMenu} // 点击遮罩关闭
                >
                    <nav
                        id="hamburger-nav"
                        className={`hamburger-nav ${navSideClass}${isClosing ? ' closing' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                className="nav-link hamburger-link"
                                onClick={requestCloseMenu} // 点击任一项后关闭菜单
                            >
                                {link.icon} {link.label}
                            </NavLink>
                        ))}
                    </nav>
                </div>
            )}
        </>
    );
}
