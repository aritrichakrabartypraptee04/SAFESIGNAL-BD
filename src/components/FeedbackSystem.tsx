import { useState } from 'react';
import { Star, Send, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface FeedbackSystemProps {
  alertId: string;
  regionId: string;
  onClose?: () => void;
}

export default function FeedbackSystem({ alertId, regionId, onClose }: FeedbackSystemProps) {
  const [accuracy, setAccuracy] = useState(0);
  const [usefulness, setUsefulness] = useState(0);
  const [comments, setComments] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const feedbackData = {
        alertId,
        regionId,
        accuracy,
        usefulness,
        comments,
        userId: auth.currentUser?.uid || null,
        timestamp: new Date().toISOString()
      };

      const path = 'feedback';
      try {
        await addDoc(collection(db, path), feedbackData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      
      setSubmitted(true);
      if (onClose) {
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      setError('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-12 glass border border-success/50 bg-success/5 text-center space-y-6 animate-in fade-in zoom-in duration-500 rounded-[3rem]">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>
        <div>
          <h3 className="text-2xl font-black tracking-tighter uppercase text-white">Feedback Received</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted mt-2">Intelligence successfully integrated into risk models.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-10 rounded-[3rem] border border-line/50 space-y-10 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-10 opacity-5">
        <Star className="w-48 h-48" />
      </div>
      
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-10">
          <div className="space-y-2">
            <h3 className="text-3xl font-black tracking-tighter uppercase text-white">Alert Feedback Node</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted">Rate accuracy and utility of disseminated intelligence</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Accuracy Rating */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Hazard Prediction Accuracy</label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setAccuracy(star)}
                    className={cn(
                      "w-12 h-12 rounded-2xl border transition-all flex items-center justify-center group/star",
                      accuracy >= star 
                        ? "bg-accent border-accent text-bg shadow-lg shadow-accent/20" 
                        : "bg-bg/50 border-line/50 text-muted hover:border-accent/50"
                    )}
                  >
                    <Star className={cn("w-6 h-6 transition-transform group-hover/star:scale-110", accuracy >= star && "fill-current")} />
                  </button>
                ))}
              </div>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted/50 ml-2">01: Inaccurate — 05: Nominal</p>
            </div>

            {/* Usefulness Rating */}
            <div className="space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Action Protocol Utility</label>
              <div className="flex gap-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setUsefulness(star)}
                    className={cn(
                      "w-12 h-12 rounded-2xl border transition-all flex items-center justify-center group/star",
                      usefulness >= star 
                        ? "bg-accent border-accent text-bg shadow-lg shadow-accent/20" 
                        : "bg-bg/50 border-line/50 text-muted hover:border-accent/50"
                    )}
                  >
                    <Star className={cn("w-6 h-6 transition-transform group-hover/star:scale-110", usefulness >= star && "fill-current")} />
                  </button>
                ))}
              </div>
              <p className="text-[8px] font-black uppercase tracking-widest text-muted/50 ml-2">01: Low Utility — 05: Life-Saving</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Ground Truth Observations</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Describe real-time conditions for model refinement..."
              className="w-full p-6 bg-bg/50 border border-line/50 rounded-3xl focus:border-accent outline-none text-sm h-32 text-white leading-relaxed transition-all resize-none"
            />
          </div>

          {error && (
            <p className="text-danger text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !accuracy || !usefulness}
            className={cn(
              "w-full py-6 rounded-3xl flex items-center justify-center gap-4 font-black uppercase tracking-[0.3em] transition-all shadow-2xl",
              isSubmitting || !accuracy || !usefulness
                ? "bg-bg/50 text-muted/30 border border-line/50 cursor-not-allowed"
                : "bg-white text-bg hover:bg-accent hover:text-white shadow-white/10"
            )}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-bg border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" /> Disseminate Feedback
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
