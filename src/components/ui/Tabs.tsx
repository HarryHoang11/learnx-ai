// ================================================================
// <Tabs /> — Tab switcher tiện dụng với accessible navigation
// ================================================================

import type { ReactNode } from "react";

export interface TabItem<T extends string = string> {
  key: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (key: T) => void;
  className?: string;
  ariaLabel?: string;
}

export default function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = "",
  ariaLabel = "Danh mục",
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`tab-list ${className}`}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab-item ${isActive ? "tab-item--active" : ""}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.icon && <span className="tab-icon" aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
            {typeof tab.count === "number" && (
              <span className="tab-count">{tab.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
