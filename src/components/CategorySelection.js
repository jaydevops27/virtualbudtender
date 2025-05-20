import React, { useState } from 'react';

const CategorySelection = ({ onCategorySelect }) => {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedStrain, setSelectedStrain] = useState(null);

  const categories = [
    {
      id: 'flower',
      name: 'Flower',
      hasStrains: true,
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 22C15.866 22 19 18.866 19 15C19 11.134 12 2 12 2C12 2 5 11.134 5 15C5 18.866 8.13401 22 12 22Z" />
        </svg>
      )
    },
    {
      id: 'pre-roll',
      name: 'Pre Rolls',
      hasStrains: true,
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 18L18 6" strokeLinecap="round" />
          <path d="M8 16L16 8" strokeLinecap="round" />
          <path d="M10 14L14 10" strokeLinecap="round" />
        </svg>
      )
    },
    {
      id: 'vaporizer',
      name: 'Vaporizers',
      hasStrains: true,
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="8" y="4" width="8" height="16" rx="2" />
          <path d="M10 8H14" />
          <path d="M12 12V16" />
        </svg>
      )
    },
    {
      id: 'concentrate',
      name: 'Concentrates',
      hasStrains: true,
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 8V6" />
          <path d="M16 12H18" />
          <path d="M12 16V18" />
          <path d="M8 12H6" />
        </svg>
      )
    },
    {
      id: 'edible',
      name: 'Edibles',
      hasStrains: true, 
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="6" y="8" width="12" height="12" rx="1" />
          <path d="M8 8V7C8 5.89543 8.89543 5 10 5H14C15.1046 5 16 5.89543 16 7V8" />
          <path d="M8 12H16" />
          <path d="M8 16H16" />
        </svg>
      )
    },
    {
      id: 'accessories',
      name: 'Accessories',
      hasStrains: false,
      icon: (
        <svg viewBox="0 0 24 24" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="4" y="8" width="16" height="12" rx="2" />
          <path d="M8 8V6C8 4.89543 8.89543 4 10 4H14C15.1046 4 16 5.89543 16 6V8" />
          <circle cx="12" cy="14" r="2" />
        </svg>
      )
    }
  ];

  const strains = [
    { id: 'sativa', name: 'Sativa', color: '#f59e0b' },
    { id: 'indica', name: 'Indica', color: '#7c3aed' },
    { id: 'hybrid', name: 'Hybrid', color: '#10b981' }
  ];

  const handleCategoryClick = (category) => {
    if (category.hasStrains) {
      setSelectedCategory(category);
    } else {
      onCategorySelect(category.id);
    }
  };

  const handleStrainSelect = (strain) => {
    setSelectedStrain(strain);
    onCategorySelect(`${selectedCategory.id}-${strain.id}`);
  };

  if (selectedCategory) {
    return (
      <div className="px-2">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className="text-xs text-gray-600 hover:text-black flex items-center gap-1 transition-colors duration-300"
          >
            ← Back to Categories
          </button>
          <span className="text-xs text-gray-600">|</span>
          <span className="text-xs font-medium">{selectedCategory.name}</span>
        </div>
        <h2 className="text-xl font-semibold mb-8 text-left">What Strain are you looking for?</h2>
        <div className="grid grid-cols-6 gap-3">
          {strains.map((strain) => (
            <button
              key={strain.id}
              onClick={() => handleStrainSelect(strain)}
              className="relative group bg-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
              style={{
                aspectRatio: '1',
                maxHeight: '150px',
                background: 'linear-gradient(145deg, #ffd789, #f0b442)',
                boxShadow: '3px 3px 6px rgba(0, 0, 0, 0.1), -2px -2px 4px rgba(255, 255, 255, 0.5)'
              }}
            >
              <div className="absolute inset-0 rounded-xl opacity-20 bg-gradient-to-br from-white via-transparent to-black" />
              <div className="relative h-full flex flex-col items-center justify-center p-2">
                <div 
                  className="w-4 h-4 rounded-full mb-1.5 group-hover:scale-110 transition-transform duration-300"
                  style={{ 
                    backgroundColor: strain.color,
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <span className="text-xs font-semibold text-black/90">{strain.name}</span>
              </div>
              <div className="absolute inset-0 rounded-xl bg-black opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Initial Category Selection
  return (
    <div className="px-2">
      <div className="grid grid-cols-6 gap-3">
        {categories.map((category) => (
          <button
            key={category.id}
            onClick={() => handleCategoryClick(category)}
            className="relative group bg-white rounded-xl transition-all duration-300 transform hover:-translate-y-0.5"
            style={{
              aspectRatio: '1',
              maxHeight: '150px',
              background: 'linear-gradient(145deg, #ffd789, #f0b442)',
              boxShadow: '3px 3px 6px rgba(0, 0, 0, 0.1), -2px -2px 4px rgba(255, 255, 255, 0.5)'
            }}
          >
            <div className="absolute inset-0 rounded-xl opacity-20 bg-gradient-to-br from-white via-transparent to-black" />
            
            <div className="relative h-full flex flex-col items-center justify-center p-2">
              <div className="w-8 h-8 mb-1 group-hover:scale-110 transition-transform duration-300 text-black/80">
                {category.icon}
              </div>
              
              <span className="text-xs font-semibold text-black/90 mt-1">
                {category.name}
              </span>
            </div>

            <div className="absolute inset-0 rounded-xl bg-black opacity-0 group-hover:opacity-5 transition-opacity duration-300" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default CategorySelection;