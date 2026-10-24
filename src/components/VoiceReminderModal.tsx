import React, { useState } from 'react';
import { 
  X, Clock, Bell, Volume2, Plus, Trash2, CheckCircle2, 
  Sparkles, Coffee, Droplet, Sun, Moon, Utensils, Activity, Play
} from 'lucide-react';
import { reminderManager, VoiceReminder } from '../utils/reminderManager';

interface VoiceReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  coachAvatar: string;
}

export const VoiceReminderModal: React.FC<VoiceReminderModalProps> = ({
  isOpen,
  onClose,
  coachAvatar
}) => {
  const [reminders, setReminders] = useState<VoiceReminder[]>(() => reminderManager.getReminders());
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newMarathi, setNewMarathi] = useState('');
  const [newCategory, setNewCategory] = useState<VoiceReminder['category']>('water');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggle = (id: string) => {
    reminderManager.toggleReminder(id);
    setReminders(reminderManager.getReminders());
  };

  const handleDelete = (id: string) => {
    reminderManager.deleteReminder(id);
    setReminders(reminderManager.getReminders());
  };

  const handlePreviewVoice = (rem: VoiceReminder) => {
    reminderManager.speakReminder(rem);
    setFeedbackMsg(`🔊 आवाज ऐकवला जात आहे: "${rem.title}"`);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleTestNow = () => {
    reminderManager.testVoiceReminderNow();
    setFeedbackMsg('⚡ टेस्ट रिमाइंडर सुरू झाला! कोच आता आवाज देईल.');
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const spokenText = newMarathi.trim() || `नमस्कार! ${newTitle} ची वेळ झाली आहे. 🌿✨`;

    reminderManager.addReminder({
      title: newTitle.trim(),
      time: newTime,
      spokenMarathi: spokenText,
      spokenEnglish: `${newTitle} - Wellness Reminder`,
      category: newCategory,
      enabled: true,
      isRecurringDaily: true
    });

    setReminders(reminderManager.getReminders());
    setIsAddingNew(false);
    setNewTitle('');
    setNewMarathi('');
    setFeedbackMsg('✅ नवीन व्हॉईस रिमाइंडर यशस्वीपणे जोडले!');
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const getCategoryIcon = (category: VoiceReminder['category']) => {
    switch (category) {
      case 'water':
        return <Droplet className="w-4 h-4 text-cyan-500" />;
      case 'shake':
        return <Sparkles className="w-4 h-4 text-emerald-500" />;
      case 'afresh':
        return <Coffee className="w-4 h-4 text-amber-500" />;
      case 'meal':
        return <Utensils className="w-4 h-4 text-orange-500" />;
      case 'sleep':
        return <Moon className="w-4 h-4 text-indigo-500" />;
      case 'workout':
        return <Activity className="w-4 h-4 text-rose-500" />;
      default:
        return <Clock className="w-4 h-4 text-[#00b074]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#f2fbf5] border-2 border-[#bceacb] rounded-[28px] w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-[#025a3a] to-[#00b074] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/60 shadow-xs shrink-0">
              <img src={coachAvatar} alt="Coach" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="font-bold text-base flex items-center gap-2">
                <span>AI व्हॉईस दिनचर्या आणि रिमाइंडर्स</span>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-bold uppercase tracking-wider">Active</span>
              </h2>
              <p className="text-xs text-white/80">वेळोवेळी आवाज देऊन पोषण आणि आरोग्याची आठवण</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Banner */}
        {feedbackMsg && (
          <div className="px-4 py-2 bg-[#dcfce7] border-b border-[#86efac] text-xs font-semibold text-[#166534] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#00b074]" />
            <span>{feedbackMsg}</span>
          </div>
        )}

        {/* Quick Action Bar */}
        <div className="p-3 bg-white border-b border-[#bceacb] flex items-center justify-between gap-2">
          <button
            onClick={handleTestNow}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-[#e6f7ed] hover:bg-[#c9f1dc] text-[#025a3a] border border-[#bceacb] rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-[#025a3a]" />
            <span>टेस्ट व्हॉईस रिमाइंडर (Test Now)</span>
          </button>

          <button
            onClick={() => setIsAddingNew(!isAddingNew)}
            className="flex items-center gap-1.5 py-2 px-3 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>नवीन रिमाइंडर</span>
          </button>
        </div>

        {/* New Reminder Form Drawer */}
        {isAddingNew && (
          <form onSubmit={handleCreateReminder} className="p-4 bg-white border-b border-[#bceacb] space-y-3">
            <div className="text-xs font-bold text-[#025a3a] uppercase">नवीन व्हॉईस रिमाइंडर जोडा:</div>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">नाव / Title</label>
                <input
                  type="text"
                  placeholder="उदा. पाणी पिणे किंवा वॉक"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2 bg-[#f8fbf9] border border-[#bceacb] rounded-xl focus:outline-none focus:border-[#00b074]"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 block mb-1">वेळ / Time</label>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full text-xs p-2 bg-[#f8fbf9] border border-[#bceacb] rounded-xl focus:outline-none focus:border-[#00b074]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 block mb-1">कोच काय बोलेल? (मराठी व्हॉईस मेसेज)</label>
              <input
                type="text"
                placeholder="उदा. नमस्कार! पाणी पिण्याची वेळ झाली आहे, फ्रेश राहा! 💧"
                value={newMarathi}
                onChange={(e) => setNewMarathi(e.target.value)}
                className="w-full text-xs p-2 bg-[#f8fbf9] border border-[#bceacb] rounded-xl focus:outline-none focus:border-[#00b074]"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 py-2 bg-[#00b074] hover:bg-[#009260] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                रिमाइंडर सेव्ह करा
              </button>
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
              >
                रद्द करा
              </button>
            </div>
          </form>
        )}

        {/* Reminders List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            दैनंदिन रूटीन आणि आठवणी ({reminders.filter(r => r.enabled).length} सुरू)
          </div>

          {reminders.map((rem) => (
            <div
              key={rem.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                rem.enabled 
                  ? 'bg-white border-[#bceacb] shadow-2xs' 
                  : 'bg-slate-50/70 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl shrink-0 ${rem.enabled ? 'bg-[#e6f7ed]' : 'bg-slate-100'}`}>
                    {getCategoryIcon(rem.category)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-800">{rem.title}</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-[#e6f7ed] text-[#025a3a]">
                        {rem.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                      {rem.spokenMarathi}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Speak Preview Button */}
                  <button
                    onClick={() => handlePreviewVoice(rem)}
                    className="p-1.5 text-slate-400 hover:text-[#00b074] rounded-lg hover:bg-[#e6f7ed] transition-colors"
                    title="आवाज ऐका (Preview Voice)"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(rem.id)}
                    className={`w-10 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                      rem.enabled ? 'bg-[#00b074]' : 'bg-slate-300'
                    }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                        rem.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>

                  {/* Delete button if custom */}
                  {!rem.id.startsWith('routine-') && (
                    <button
                      onClick={() => handleDelete(rem.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors ml-1"
                      title="हटवा"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Information Callout on Phone Lock & Web vs Native APK */}
        <div className="mx-4 mb-2 p-3 bg-amber-50/80 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-950">
            <span>🔒 फोन लॉक आणि रिमाइंडर्स (Phone Lock FAQ):</span>
          </div>
          <p className="leading-relaxed text-[11px] text-slate-700">
            <strong>वेब ब्राउझर (Chrome/Safari) मर्यादा:</strong> फोन स्क्रीन लॉक झाल्यावर बॅटरी वाचवण्यासाठी मोबाईल ऑपरेटिंग सिस्टीम ब्राउझर टॅबला झोपवते (Freeze करते). त्यामुळे वेबवर स्क्रीन लॉक असताना आवाज येत नाही.
          </p>
          <p className="leading-relaxed text-[11px] text-[#025a3a] font-medium pt-0.5">
            <strong>नक्की तोडगा (Native Android App):</strong> जेव्हा तुम्ही हे <strong>Android APK</strong> म्हणून इन्स्टॉल कराल, तेव्हा फोन पूर्णपणे लॉक असला तरी Android चे <em>AlarmManager & WakeLock</em> स्क्रीन चालू करून कोचचा आवाज स्पीकरवर वाजवतील!
          </p>
        </div>

        {/* Footer Note */}
        <div className="px-5 py-3 bg-[#e6f7ed] border-t border-[#bceacb] text-center">
          <p className="text-[11px] text-[#025a3a] font-medium">
            💡 <strong>व्हॉईस कमांड:</strong> थेट बोला: <em>"मला २ मिनिटांनी पाणी पिण्याची आठवण कर"</em> किंवा <em>"५ मिनिटांनी शेक पिण्यास सांग"</em>.
          </p>
        </div>

      </div>
    </div>
  );
};
