import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export default function CustomSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  onCreateNew,
  createNewText = "+ Create New",
  multiple = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedValues = multiple
    ? (Array.isArray(value) ? value : [])
    : [];
  const selectedOptions = multiple
    ? options.filter((opt) => selectedValues.includes(opt.value))
    : [];
  const selectedOption = options.find(opt => opt.value === value);
  const displayLabel = multiple
    ? (
      selectedOptions.length === 0
        ? placeholder
        : selectedOptions.length <= 2
          ? selectedOptions.map((opt) => opt.label).join(', ')
          : `${selectedOptions.length} selected`
    )
    : (selectedOption ? selectedOption.label : placeholder);
  const hasValue = multiple
    ? selectedOptions.length > 0
    : Boolean(selectedOption);

  const handleOptionSelect = (optionValue) => {
    if (multiple) {
      const next = selectedValues.includes(optionValue)
        ? selectedValues.filter((item) => item !== optionValue)
        : [...selectedValues, optionValue];
      onChange(next);
      return;
    }

    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="customSelectContainer" ref={containerRef}>
      <div 
        className={`customSelectHeader ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: hasValue ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {displayLabel}
        </span>
        <ChevronDown 
          size={16} 
          className="selectIcon" 
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }} 
        />
      </div>

      {isOpen && (
        <div className="customSelectList">
          {options.map((option) => (
            <div 
              key={option.value}
              className={`customSelectOption ${
                (multiple ? selectedValues.includes(option.value) : option.value === value)
                  ? 'selected'
                  : ''
              }`}
              onClick={() => handleOptionSelect(option.value)}
            >
              {option.color && (
                <span 
                  style={{ 
                    display: 'inline-block', 
                    width: '10px', 
                    height: '10px', 
                    borderRadius: '50%', 
                    backgroundColor: option.color,
                    marginRight: '10px'
                  }} 
                />
              )}
              {multiple && selectedValues.includes(option.value) ? '✓ ' : ''}
              {option.label}
            </div>
          ))}
          
          {onCreateNew && (
            <div 
              className="customSelectOption createNew"
              onClick={() => {
                setIsOpen(false);
                onCreateNew();
              }}
            >
              <Plus size={14} style={{ marginRight: '8px' }} />
              {createNewText}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
