import React, { createContext, useCallback, useContext, useRef, useState } from 'react';

interface UploadActivityContextType {
  isUploading: boolean;
  setUploading: (uploading: boolean) => void;
}

const UploadActivityContext = createContext<UploadActivityContextType | undefined>(undefined);

export const UploadActivityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  // Reference counter so concurrent uploads don't toggle each other off prematurely
  const counterRef = useRef(0);

  const setUploading = useCallback((uploading: boolean) => {
    if (uploading) {
      counterRef.current += 1;
      setIsUploading(true);
    } else {
      counterRef.current = Math.max(0, counterRef.current - 1);
      if (counterRef.current === 0) {
        setIsUploading(false);
      }
    }
  }, []);

  return (
    <UploadActivityContext.Provider value={{ isUploading, setUploading }}>
      {children}
    </UploadActivityContext.Provider>
  );
};

export const useUploadActivity = () => {
  const ctx = useContext(UploadActivityContext);
  if (!ctx) {
    // Allow consumption outside provider as a no-op (defensive)
    return { isUploading: false, setUploading: () => {} };
  }
  return ctx;
};
