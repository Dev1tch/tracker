import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

export default function CustomSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  onCreateNew,
  createNewText = "+ Create New"
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

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div className="customSelectContainer" ref={containerRef}>
      <div 
        className={`customSelectHeader ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span style={{ color: selectedOption ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {selectedOption ? selectedOption.label : placeholder}
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
              className={`customSelectOption ${option.value === value ? 'selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
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
