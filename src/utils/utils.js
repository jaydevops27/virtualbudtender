// utils.js - Common utility functions
export const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };
  
  export const formatPercentage = (value) => {
    return `${parseFloat(value).toFixed(1)}%`;
  };
  
  export const generateProductDescription = (product) => {
    let description = `${product.Name} is a ${product.strain || ''} ${product.CanonicalClassification.Name.toLowerCase()}`;
    
    if (product.thcMax) {
      description += ` featuring ${product.thcMin}-${product.thcMax}% THC`;
    }
    
    if (product.cbdMax) {
      description += ` and ${product.cbdMin}-${product.cbdMax}% CBD`;
    }
    
    return description.trim();
  };
  
  export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  export const throttle = (func, limit) => {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };