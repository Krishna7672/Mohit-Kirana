import React, { useState } from 'react';
import { Lock, Store, Delete, ArrowRight } from 'lucide-react';

interface Props {
  isLocked: boolean;
  correctPin: string;
  shopName: string;
  onUnlock: () => void;
}

export const PinLockModal: React.FC<Props> = ({
  isLocked,
  correctPin,
  shopName,
  onUnlock,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [errorMsg, setErrorMsg] = useState(false);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (pinInput.length < 6) {
      const next = pinInput + digit;
      setPinInput(next);
      setErrorMsg(false);
      if (next === correctPin) {
        onUnlock();
        setPinInput('');
      } else if (next.length >= correctPin.length) {
        setErrorMsg(true);
      }
    }
  };

  const handleDelete = () => {
    setPinInput((prev) => prev.slice(0, -1));
    setErrorMsg(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === correctPin) {
      onUnlock();
      setPinInput('');
    } else {
      setErrorMsg(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-sm w-full p-8 border border-slate-200 dark:border-slate-800 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-kirana-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-kirana-600/30 mb-3">
          <Lock className="w-6 h-6" />
        </div>

        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">
          {shopName || 'Mohit Kirana'}
        </h3>
        <p className="text-xs text-slate-500 mb-6">Enter Owner PIN to unlock POS counter</p>

        {/* PIN Dots Indicator */}
        <div className="flex justify-center gap-3 mb-6">
          {Array.from({ length: Math.max(4, correctPin.length) }).map((_, idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                idx < pinInput.length
                  ? 'bg-kirana-600 border-kirana-600 scale-110'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <p className="text-xs text-red-600 font-bold mb-4 animate-bounce">
            Incorrect PIN. Please try again.
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white font-extrabold text-xl shadow-sm transition-all active:scale-95 flex items-center justify-center mx-auto"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            onClick={handleDelete}
            className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-500 font-bold text-sm transition-all flex items-center justify-center mx-auto"
          >
            <Delete className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-white font-extrabold text-xl shadow-sm transition-all active:scale-95 flex items-center justify-center mx-auto"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleManualSubmit}
            className="w-16 h-16 rounded-2xl bg-kirana-700 hover:bg-kirana-800 text-white font-bold transition-all shadow-md flex items-center justify-center mx-auto"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
