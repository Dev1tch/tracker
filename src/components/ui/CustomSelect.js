import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { ChevronDown, Plus } from 'lucide-react';

const LIST_GAP = 6;
const VIEWPORT_PADDING = 12;
const PREFERRED_MAX_HEIGHT = 280;
const MIN_OPEN_DOWN_SPACE = 160;

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  onCreateNew,
  createNewText = "+ Create New",
  multiple = false,
  searchable = false,
  searchPlaceholder = "Search",
  listPosition = 'fixed'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [listStyle, setListStyle] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef(null);
  const headerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on outer scroll — the list is fixed-positioned to the trigger's
  // initial rect, so any ancestor scroll would otherwise leave it floating.
  useEffect(() => {
    if (!isOpen) return undefined;
    if (listPosition !== 'fixed') return undefined;
    function handleScroll(event) {
      if (containerRef.current && containerRef.current.contains(event.target)) {
        return;
      }
      setIsOpen(false);
      setSearchTerm('');
    }
    function handleResize() {
      setIsOpen(false);
      setSearchTerm('');
    }
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [isOpen, listPosition]);

  // Pin the dropdown to viewport coords so it doesn't add to any ancestor's
  // scrollable overflow (which would visually "enlarge" a parent modal).
  useLayoutEffect(() => {
    if (!isOpen) return;
    if (listPosition !== 'fixed') {
      return;
    }
    const trigger = headerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PADDING;
    const spaceAbove = rect.top - VIEWPORT_PADDING;
    const openUp = spaceBelow < MIN_OPEN_DOWN_SPACE && spaceAbove > spaceBelow;
    const maxHeight = Math.max(
      120,
      Math.min(PREFERRED_MAX_HEIGHT, openUp ? spaceAbove : spaceBelow)
    );
    const baseStyle = {
      position: 'fixed',
      left: Math.max(VIEWPORT_PADDING, rect.left),
      width: rect.width,
      maxHeight,
      overflowY: 'auto',
      overflowX: 'hidden',
      zIndex: 10000,
    };
    if (openUp) {
      baseStyle.bottom = window.innerHeight - rect.top + LIST_GAP;
      baseStyle.top = 'auto';
    } else {
      baseStyle.top = rect.bottom + LIST_GAP;
      baseStyle.bottom = 'auto';
    }
    setListStyle(baseStyle);
  }, [isOpen, listPosition]);

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
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const visibleOptions =
    searchable && normalizedSearch
      ? options.filter((option) =>
          [option.label, option.value, option.searchText]
            .filter(Boolean)
            .some((text) => String(text).toLowerCase().includes(normalizedSearch))
        )
      : options;

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
    setSearchTerm('');
  };

  return (
    <div className="customSelectContainer" ref={containerRef}>
      <div
        ref={headerRef}
        className={`customSelectHeader ${isOpen ? 'open' : ''}`}
        onClick={() => {
          if (isOpen) setSearchTerm('');
          setIsOpen(!isOpen);
        }}
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
        <div
          className={`customSelectList ${listPosition === 'local' ? 'local' : ''}`}
          style={listStyle || undefined}
          onWheel={(e) => e.stopPropagation()}
        >
          {searchable && (
            <div className="customSelectSearchWrap">
              <input
                className="customSelectSearch"
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder={searchPlaceholder}
                autoFocus
              />
            </div>
          )}

          {visibleOptions.map((option) => (
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
                    marginRight: '10px',
                    flexShrink: 0
                  }}
                />
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {multiple && selectedValues.includes(option.value) ? '✓ ' : ''}
                {option.label}
              </span>
            </div>
          ))}

          {visibleOptions.length === 0 && (
            <div className="customSelectEmpty">No matches</div>
          )}

          {onCreateNew && (
            <div
              className="customSelectOption createNew"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm('');
                onCreateNew();
              }}
            >
              <Plus size={14} style={{ marginRight: '8px', flexShrink: 0 }} />
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {createNewText}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
