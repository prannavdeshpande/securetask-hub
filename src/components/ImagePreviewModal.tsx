import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export const ImagePreviewModal = ({ isOpen, onClose, imageUrl }: ImagePreviewModalProps) => {
  const [scale, setScale] = useState(1);

  if (!imageUrl) {
    return null;
  }

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  
  const handleDownload = async () => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'image';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed:', e);
    }
  };

  const handleClose = () => {
    setScale(1);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[100vw] max-h-[100vh] w-screen h-screen p-0 bg-black/95 border-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>A larger view of the image attachment.</DialogDescription>
        </DialogHeader>
        
        {/* Top bar with controls */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10"
            >
              <ZoomOut className="h-5 w-5" />
            </Button>
            <span className="text-white text-sm min-w-[50px] text-center">{Math.round(scale * 100)}%</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10"
            >
              <ZoomIn className="h-5 w-5" />
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleClose}
              className="text-white hover:bg-white/20 rounded-full h-10 w-10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        
        {/* Image container */}
        <div 
          className="flex items-center justify-center w-full h-full overflow-auto p-4"
          onClick={handleClose}
        >
          <img 
            src={imageUrl} 
            alt="Preview" 
            className="max-w-full max-h-full object-contain transition-transform duration-200 select-none"
            style={{ transform: `scale(${scale})` }}
            onContextMenu={(e) => e.preventDefault()} 
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
