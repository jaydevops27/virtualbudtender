import React from 'react';

const LoadingAnimation = ({ type = 'dots', size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-1 h-1',
    medium: 'w-1.5 h-1.5',
    large: 'w-2 h-2'
  };

  if (type === 'spinner') {
    return (
      <div className="flex justify-center items-center">
        <div className="animate-spin rounded-full border-2 border-black border-t-transparent h-5 w-5"></div>
      </div>
    );
  }

  return (
    <span className="loading-dots">
      <span className="inline-flex items-center">
        <div 
          className={`${sizeClasses[size]} bg-black rounded-full animate-bounce mx-0.5`} 
          style={{ animationDelay: '0ms' }}
        ></div>
        <div 
          className={`${sizeClasses[size]} bg-black rounded-full animate-bounce mx-0.5`} 
          style={{ animationDelay: '100ms' }}
        ></div>
        <div 
          className={`${sizeClasses[size]} bg-black rounded-full animate-bounce mx-0.5`} 
          style={{ animationDelay: '200ms' }}
        ></div>
      </span>
    </span>
  );
};

export default LoadingAnimation;