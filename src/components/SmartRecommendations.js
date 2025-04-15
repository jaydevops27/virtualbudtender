import React, { useRef } from 'react';
import { ThumbsUp, ThumbsDown, Sparkles, ChevronRight, ChevronLeft } from 'lucide-react';

const SmartRecommendations = ({ recommendations, onProductSelect, onLike, onDislike }) => {
  const scrollRef = useRef(null);
  
  if (!recommendations?.length) return null;

  const handleSeeMore = () => {
    const userQuery = `Show me more ${recommendations[0]?.strain || ''} products`;
    onProductSelect({
      type: 'RECOMMENDATION_REQUEST',
      query: userQuery,
      filters: {
        strain: recommendations[0]?.strain || '',
        excludeProducts: recommendations
          .filter(rec => rec?.Name)
          .map(rec => rec.Name)
      }
    });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' });
  };

  return (
    <div className="w-full bg-transparent">
      <div className="text-left mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="text-[#8B6D3F]" size={20} />
          <h2 className="text-xl font-semibold">Personalized Recommendations</h2>
        </div>
        <p className="text-sm text-gray-600">Curated specifically for your preferences</p>
      </div>

      <div className="relative">
        <button 
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        >
          <ChevronLeft size={24} />
        </button>

        <button 
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        >
          <ChevronRight size={24} />
        </button>

        <div 
          ref={scrollRef}
          className="flex overflow-x-auto gap-4 pb-4 hide-scrollbar"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            scrollBehavior: 'smooth'
          }}
        >
          {recommendations.map((product, index) => (
            <div 
              key={`${product.Name}-${index}`}
              className="flex-none w-[320px] bg-white rounded-lg p-4 border relative hover:shadow-lg transition-all duration-300"
              style={{ scrollSnapAlign: 'start' }}
            >
              <div className="absolute top-2 left-2 z-10">
                <div className="w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white font-semibold">
                  {index + 1}
                </div>
              </div>

              {product.inventory <= 1 && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                    Low Stock
                  </span>
                </div>
              )}

              <h3 className="text-lg font-semibold mt-8 mb-4 text-center">{product.Name}</h3>

              <div className="w-full h-[200px] flex items-center justify-center">
                <img 
                  src={product.photoUrl}
                  alt={product.Name}
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/cannabis-placeholder.png";
                  }}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-4 mb-3 justify-center">
                {product.THC && (
                  <span className="bg-[#B8A468] text-black px-2 py-1 rounded text-xs">
                    THC: {product.THC}
                  </span>
                )}
                {product.strain && (
                  <span className="bg-[#B8A468] text-black px-2 py-1 rounded text-xs">
                    {product.strain}
                  </span>
                )}
                {product.Size && (
                  <span className="bg-[#B8A468] text-black px-2 py-1 rounded text-xs">
                    Size: {product.Size}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 line-clamp-3 mb-4 text-center">
                {product.description}
              </p>

              <button 
                onClick={() => onProductSelect(product)}
                className="w-full bg-[#8B6D3F] text-white py-2 rounded-lg hover:bg-[#725A34] transition-colors mb-3"
              >
                Shop Now
              </button>

              <div className="flex justify-center gap-4 pt-3 border-t">
                <button
                  onClick={() => onLike(product.CatalogItemId)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
                >
                  <ThumbsUp size={16} />
                  Like
                </button>
                <button
                  onClick={() => onDislike(product.CatalogItemId)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-red-600 transition-colors"
                >
                  <ThumbsDown size={16} />
                  Dislike
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {recommendations.length >= 3 && (
        <div className="text-center mt-6">
          <button 
            onClick={handleSeeMore}
            className="px-6 py-2 text-[#8B6D3F] border border-[#8B6D3F] rounded hover:bg-[#8B6D3F] hover:text-white transition-all"
          >
            See More Recommendations
          </button>
        </div>
      )}
    </div>
  );
};

export default SmartRecommendations;