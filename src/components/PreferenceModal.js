import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Type, Info, Pause, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PreferenceModal = ({ onSelect }) => {
  const [showInfo, setShowInfo] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    const playAudio = async () => {
      try {
        if (audio) {
          audio.volume = 1;
          await audio.play();
          setIsPlaying(true);
          setDuration(audio.duration);
        }
      } catch (err) {
        console.log('Auto-play failed:', err);
        setIsPlaying(false);
      }
    };

    playAudio();

    return () => {
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e) => {
    const seekTime = e.target.value;
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
      animate={{ opacity: 1, backdropFilter: 'blur(8px)' }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 25
        }}
        className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 relative overflow-hidden"
      >
        <audio 
          ref={audioRef}
          className="hidden"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
          onEnded={() => setIsPlaying(false)}
          autoPlay
        >
          <source src="/welcome-voice.mp4" type="audio/mp4" />
        </audio>

        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="absolute top-3 right-3 flex items-center gap-4"
        >
          <motion.div 
            className="flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
          >
            <motion.input
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="w-24 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer 
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 
                [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-[#f0b442] 
                [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:transition-all
                hover:[&::-webkit-slider-thumb]:scale-125"
            />
            <motion.button
              onClick={toggleAudio}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
            >
              {isPlaying ? (
                <Pause size={20} className="text-gray-600" />
              ) : (
                <Play size={20} className="text-gray-600" />
              )}
            </motion.button>
          </motion.div>
          <motion.button
            onClick={() => setShowInfo(!showInfo)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Show information"
          >
            <Info size={20} className="text-gray-600" />
          </motion.button>
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-6"
        >
          <motion.h2 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-2xl font-bold mb-2"
          >
            Welcome to Runway Pot
          </motion.h2>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-gray-600"
          >
            Choose how you'd like to interact with our Virtual Budtender
          </motion.p>

          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{
                  height: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 }
                }}
                className="mt-6 mb-8 overflow-hidden"
              >
                <h3 className="font-bold text-lg mb-4">About the Virtual Budtender</h3>
                <ul className="space-y-3">
                  {[
                    "Personalized product recommendations",
                    "Expert cannabis knowledge",
                    "Easy voice or text interactions",
                    "Private and confidential"
                  ].map((text, index) => (
                    <motion.li
                      key={index}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start gap-2"
                    >
                      <span className="text-[#f0b442] text-lg">•</span>
                      <span>{text}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex flex-col gap-3 mt-8">
            <motion.button
              onClick={() => onSelect('text')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Type size={20} />
              <span>Text Chat</span>
            </motion.button>
            
            <motion.button
              onClick={() => onSelect('voice')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.7 }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-[#f0b442] text-black rounded-xl hover:bg-[#fcaf17] transition-colors"
            >
              <Volume2 size={20} />
              <span>Voice Chat</span>
            </motion.button>
          </div>

          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-gray-500 mt-6"
          >
            Select your preferred method of interaction to begin
          </motion.p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default PreferenceModal;