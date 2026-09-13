import React, { useState } from "react";

interface FilterPanelProps {
  tasks: any[];
  searchQuery: string;
  onFilterChange: (filters: any) => void;
}

const FilterPanel: React.FC<FilterPanelProps> = ({ tasks, searchQuery, onFilterChange }) => {
  const [filters, setFilters] = useState({
    difficulty: "all",
    mastery: "all",
    type: "all",
  });

  const handleChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    onFilterChange(filters);
  };

  return (
    <div className="filter-panel">
      <div className="filter-group">
        <label>Difficulty:</label>
        <select
          value={filters.difficulty}
          onChange={(e) => handleChange("difficulty", e.target.value)}
        >
          <option value="all">All Difficulties</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Mastery Level:</label>
        <select
          value={filters.mastery}
          onChange={(e) => handleChange("mastery", e.target.value)}
        >
          <option value="all">All Mastery Levels</option>
          <option value="0-30">Low (0-30%)</option>
          <option value="25-50">Medium (25-50%)</option>
          <option value="50-75">High (50-75%)</option>
          <option value="75-100">Mastered (75-100%)</option>
        </select>
      </div>

      <div className="filter-group">
        <label>Node Type:</label>
        <select
          value={filters.type}
          onChange={(e) => handleChange("type", e.target.value)}
        >
          <option value="all">All Types</option>
          <option value="concept">Concept</option>
          <option value="example">Example</option>
          <option value="formula">Formula</option>
          <option value="question">Question</option>
        </select>
      </div>

      <div className="filter-actions">
        <button className="filter-btn" onClick={() => onFilterChange(filters)}>Apply Filters</button>
      </div>
    </div>
  );
};

export default FilterPanel;