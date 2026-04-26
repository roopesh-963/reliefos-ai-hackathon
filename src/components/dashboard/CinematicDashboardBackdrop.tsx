import { useState } from 'react';
import { motion } from 'motion/react';

const DASHBOARD_VIDEO_PATH = '/media/dashboard/crsisvideo.mp4';

export function CinematicDashboardBackdrop() {
  const [videoAvailable, setVideoAvailable] = useState(true);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {videoAvailable ? (
        <video
          className="absolute inset-0 h-full w-full object-cover scale-[1.04] opacity-[0.76] saturate-[1.02]"
          src={DASHBOARD_VIDEO_PATH}
          autoPlay
          muted
          loop
          playsInline
          onError={() => setVideoAvailable(false)}
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(52,120,255,0.22),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(255,122,54,0.16),transparent_26%),linear-gradient(180deg,#03060a_0%,#07101b_45%,#03050a_100%)]" />
      )}

      <div className="absolute inset-0 bg-[#02050b]/8 backdrop-blur-[0.35px]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,5,11,0.26)_0%,rgba(2,5,11,0.12)_32%,rgba(2,5,11,0.04)_58%,rgba(2,5,11,0.16)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_74%_34%,rgba(82,183,255,0.28),transparent_22%),radial-gradient(circle_at_78%_58%,rgba(255,126,71,0.18),transparent_18%),radial-gradient(circle_at_62%_50%,rgba(255,255,255,0.06),transparent_16%)]" />
      <StaticSceneFallback />
      <motion.div
        animate={{ opacity: [0.18, 0.28, 0.18], scale: [1, 1.02, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute inset-0"
      >
        <div className="absolute left-[12%] top-[20%] h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(122,224,255,0.2),transparent_72%)] blur-3xl" />
        <div className="absolute bottom-[18%] right-[14%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(82,183,255,0.18),transparent_74%)] blur-3xl" />
      </motion.div>

      <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#02050b]/46 via-[#02050b]/16 to-transparent" />
    </div>
  );
}

function StaticSceneFallback() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(82,183,255,0.16),transparent_22%),radial-gradient(circle_at_82%_16%,rgba(82,183,255,0.14),transparent_20%),radial-gradient(circle_at_74%_40%,rgba(82,183,255,0.16),transparent_18%),radial-gradient(circle_at_50%_78%,rgba(82,183,255,0.08),transparent_24%),linear-gradient(180deg,rgba(4,10,20,0.18)_0%,rgba(4,10,20,0.08)_35%,rgba(4,10,20,0.3)_100%)]" />
      <div className="absolute inset-x-0 top-[22%] h-px bg-gradient-to-r from-transparent via-cyan-200/18 to-transparent" />
      <div className="absolute inset-x-0 bottom-[18%] h-px bg-gradient-to-r from-transparent via-cyan-200/22 to-transparent" />
      <div className="absolute inset-y-[18%] left-[12%] w-px bg-gradient-to-b from-transparent via-cyan-200/10 to-transparent" />
      <div className="absolute inset-y-[12%] right-[14%] w-px bg-gradient-to-b from-transparent via-cyan-200/8 to-transparent" />
    </div>
  );
}
