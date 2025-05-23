import React from 'react';
import { Play, Pause } from 'lucide-react';
import SmartRecommendations from './SmartRecommendations';
import CategorySelection from './CategorySelection';

const Message = ({ 
  message, 
  isUser, 
  onPlayback, 
  isPlaying, 
  playingAudioId, 
  isMuted,
  recommendations,
  onProductSelect,
  onLike,
  onDislike,
  onCategorySelect 
}) => {
  const handleProductSelect = (product) => {
    if (product.type === 'RECOMMENDATION_REQUEST') {
      onCategorySelect({
        type: 'REQUEST_MORE',
        filters: {
          category: product.filters?.category,
          strain: product.filters?.strain,
          excludeProducts: product.filters?.excludeProducts
        }
      });
    } else {
      onProductSelect(product);
    }
  };

  const shouldShowContent = () => {
    if (typeof message.content !== 'string') return true;
    if (!recommendations?.length) return true;
    return !message.content.includes('running low on stock');
  };

  return (
    <div className={`flex items-start ${isUser ? 'justify-end' : 'justify-start'} w-full mb-4`}>
      <div className={`flex items-start ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-2 ${isUser ? 'max-w-[75%]' : 'w-full'}`}>
        {!isUser && !isMuted && typeof message.content === 'string' && (
          <button
            onClick={() => onPlayback(message.content, message.id)}
            className={`flex-shrink-0 p-2 rounded-full transition-colors ${
              playingAudioId === message.id ? 'bg-gray-200' : 'bg-white hover:bg-gray-100'
            }`}
            disabled={playingAudioId !== null && playingAudioId !== message.id}
          >
            {playingAudioId === message.id && isPlaying ? (
              <Pause size={16} className="text-black" />
            ) : (
              <Play size={16} className="text-black" />
            )}
          </button>
        )}
        
        <div 
          className={`rounded-lg ${
            isUser 
              ? 'bg-black text-white ml-auto py-2 px-3 rounded-br-none' 
              : 'bg-white text-black w-full p-4 rounded-bl-none'
          }`}
          style={{
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
        >
          {shouldShowContent() && (
            React.isValidElement(message.content) 
              ? message.content
              : <div className="text-left block whitespace-pre-wrap text-sm">
                  {message.content}
                </div>
          )}
          
          {message.showCategories && (
            <div className="mt-4 -mx-2">
              <CategorySelection onCategorySelect={onCategorySelect} />
            </div>
          )}
          
          {!isUser && recommendations?.length > 0 && (
            <div className="mt-4">
              <SmartRecommendations
                recommendations={recommendations}
                onProductSelect={handleProductSelect}
                onLike={onLike}
                onDislike={onDislike}
                category={message.category}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;