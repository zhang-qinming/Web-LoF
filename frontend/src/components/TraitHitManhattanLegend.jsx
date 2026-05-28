import React from 'react';
import FloatingLegend from './FloatingLegend';

export default function TraitHitManhattanLegend({
    items,
    collapsed,
    onToggleCollapsed,
    title = 'Programs',
    anchorPlotRef,
}) {
    return (
        <FloatingLegend
            items={items}
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            title={title}
            width={{ expanded: 196, collapsed: 118 }}
            maxHeight={282}
            defaultPlacement="right"
            defaultTop={78}
            defaultSideOffset={12}
            anchorPlotRef={anchorPlotRef}
        />
    );
}
