import React from 'react';
import FloatingLegend from './FloatingLegend';

export default function TraitHitManhattanLegend({
    items,
    collapsed,
    onToggleCollapsed,
    title = 'Programs',
}) {
    return (
        <FloatingLegend
            items={items}
            collapsed={collapsed}
            onToggleCollapsed={onToggleCollapsed}
            title={title}
            width={{ expanded: 186, collapsed: 120 }}
            maxHeight={268}
            defaultPlacement="right"
            defaultTop={84}
            defaultSideOffset={12}
        />
    );
}
