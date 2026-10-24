import React from 'react';
import { Bell, Volume2, X, Check, Clock } from 'lucide-react';
import { VoiceReminder, reminderManager } from '../utils/reminderManager';

interface FiredReminderAlertProps {
  reminder: VoiceReminder | null;
  onDismiss: () => void;
  coachAvatar: string;
}

export const FiredReminderAlert: React.FC<FiredReminderAlertProps> = ({
  reminder,
  onDismiss,
  coachAvatar
}) => {
  if (!reminder) return null;

  const handleSnooze = () => {
    // Add snooze reminder in 5 minutes
    const snoozeTime = new Date(Date.now() + 5 * 60 * 1000);
    const timeStr = `${String(snoozeTime.getHours()).padStart(2, '0')}:${String(snoozeTime.getMinutes()).padStart(2, '0')}`;
    reminderManager.addReminder({
      title: `${reminder.title} (Snoozed 5m)`,
      time: timeStr,
      spokenMarathi: `नमस्कार! ५ मिनिटे झाली आहेत, ${reminder.title} पूर्ण करून घ्या! 🌿✨`,
      spokenEnglish: reminder.spokenEnglish,
      category: reminder.category,
      enabled: true,
      isRecurringDaily: false,
      exactTimestamp: snoozeTime.getTime()
    });
    onDismiss();
  };

  const handleReplay = () => {
    reminderManager.speakReminder(reminder);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-top-4 duration-300">
      <div className="bg-white border-2 border-[#00b074] rounded-2xl p-4 shadow-2xl relative overflow-hidden">
        
        {/* Glow ambient background */}
        <div className="absolute -top-10 -right-10 w-24 h-24 bg-[#00b074]/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start gap-3">
          
          {/* Coach Avatar with pulsing audio indicator */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00b074] shadow-md">
              <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-[#00b074] items-center justify-center text-[8px] text-white">
                <Volume2 className="w-2.5 h-2.5" />
              </span>
            </span>
          </div>

          {/* Reminder Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#e6f7ed] text-[#025a3a] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <Bell className="w-3 h-3 text-[#00b074]" />
                व्हॉईस आठवण
              </span>
              <span className="text-xs text-slate-400 font-medium">{reminder.time}</span>
            </div>

            <h3 className="font-bold text-slate-800 text-sm mt-1 truncate">
              {reminder.title}
            </h3>

            <p className="text-xs text-slate-600 mt-1 bg-[#f0faf3] p-2 rounded-xl border border-[#bceacb]/60 leading-relaxed font-medium">
              "{reminder.spokenMarathi}"
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={onDismiss}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>समजले / Done</span>
              </button>

              <button
                onClick={handleSnooze}
                className="flex items-center justify-center gap-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all active:scale-95"
                title="५ मिनिटांनी पुन्हा आठवण करा"
              >
                <Clock className="w-3 h-3 text-slate-500" />
                <span>५ मिनिटे (Snooze)</span>
              </button>

              <button
                onClick={handleReplay}
                className="p-1.5 text-slate-500 hover:text-[#00b074] hover:bg-[#e6f7ed] rounded-xl transition-colors"
                title="आवाज पुन्हा ऐका"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onDismiss}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
