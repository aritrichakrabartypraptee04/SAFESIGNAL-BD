import { useState } from 'react';
import { AlertTriangle, Send, CheckCircle2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

interface FalseAlertReportProps {
  alertId: string;
  onClose?: () => void;
}

export default function FalseAlertReport({ alertId, onClose }: FalseAlertReportProps) {
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedback.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const reportData = {
        alertId,
        userId: auth.currentUser?.uid || 'anonymous',
        feedback: feedback.trim(),
        timestamp: new Date().toISOString()
      };

      const path = 'false_alerts';
      try {
        await addDoc(collection(db, path), reportData);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
      
      setSubmitted(true);
      if (onClose) {
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      console.error('Failed to report false alert:', err);
      setError('Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-10 glass border border-success/50 bg-success/5 text-center space-y-6 animate-in fade-in zoom-in duration-500 rounded-[2.5rem]">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle2 className="w-8 h-8 text-success" />
        </div>
        <div>
          <h3 className="text-xl font-black tracking-tighter uppercase text-white">Report Logged</h3>
          <p className="text-[8px] font-black uppercase tracking-widest text-muted mt-2 leading-relaxed">Intelligence successfully queued for verification.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-8 rounded-[2.5rem] border border-danger/30 space-y-8 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
        <AlertTriangle className="w-32 h-32 text-danger" />
      </div>

      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-xl transition-all z-20"
        >
          <X className="w-4 h-4 text-muted hover:text-white" />
        </button>
      )}
      
      <div className="relative z-10 space-y-6">
        <div className="flex items-center gap-4 text-danger">
          <div className="p-3 bg-danger/10 rounded-2xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-2xl font-black tracking-tighter uppercase">Signal Anomaly</h3>
        </div>
        
        <p className="text-[10px] font-black uppercase tracking-widest text-muted leading-relaxed">
          If this alert contradicts local ground-truth observations, 
          report the anomaly for predictive model recalibration.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-2">Ground Truth Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Describe the discrepancy (e.g., water level nominal, zero precipitation)..."
              className="w-full p-5 bg-bg/50 border border-line/50 rounded-2xl focus:border-danger/50 outline-none text-xs h-28 text-white leading-relaxed transition-all resize-none"
              required
            />
          </div>

          {error && (
            <p className="text-danger text-[10px] font-black uppercase tracking-widest text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !feedback.trim()}
            className={cn(
              "w-full py-5 rounded-2xl flex items-center justify-center gap-4 font-black uppercase tracking-[0.2em] transition-all shadow-2xl",
              isSubmitting || !feedback.trim()
                ? "bg-bg/50 text-muted/30 border border-line/50 cursor-not-allowed"
                : "bg-danger text-white hover:bg-danger/80 shadow-danger/20"
            )}
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" /> Submit Anomaly
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
