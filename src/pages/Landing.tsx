/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FormEvent, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Map as MapIcon,
  Users,
  Truck,
  BarChart3,
  Cpu,
  X,
  Menu,
  ChevronRight,
  Radio,
  Zap,
  Lock,
  Mail,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type AuthMode = 'signin' | 'signup' | null;
type RoleOption = 'citizen' | 'rescue_team' | 'admin';
const cinematicEase = [0.16, 1, 0.3, 1] as const;
const authContainerVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: cinematicEase,
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 20,
    transition: { duration: 0.4 },
  },
} as const;
const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: cinematicEase },
  },
} as const;
const modalItemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
} as const;
const heroContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
} as const;
const heroHeadlineVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 1.2, ease: cinematicEase },
  },
} as const;

const heroSignalCards = [
  { label: 'SOS Ingest', value: '1.2k/min', accent: 'text-[var(--color-relief-orange)]' },
  { label: 'Convoys Routed', value: '184', accent: 'text-white' },
  { label: 'AI Confidence', value: '97.4%', accent: 'text-[var(--color-relief-orange)]' },
] as const;

const capabilityItems = [
  {
    title: 'Live awareness',
    icon: Radio,
    desc: 'Real-time streaming telemetry from global hotspots and sensors.',
  },
  {
    title: 'Dispatch orchestration',
    icon: MapIcon,
    desc: 'AI-optimized routing for personnel and specialized response units.',
  },
  {
    title: 'Citizen workflows',
    icon: Users,
    desc: 'Direct decentralized coordination with civilian networks on the ground.',
  },
  {
    title: 'Supply operations',
    icon: Truck,
    desc: 'End-to-end logistics tracking from procurement to extraction.',
  },
  {
    title: 'Predictive analytics',
    icon: BarChart3,
    desc: 'Anticipate crisis evolution before it reaches the boiling point.',
  },
  {
    title: 'AI-Guidance Layer',
    icon: Cpu,
    desc: 'LLM-powered decision support for high-stakes environments.',
  },
] as const;

function Navbar({ onAuthClick }: { onAuthClick: (mode: AuthMode) => void }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav
      className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-white/5 bg-[var(--color-relief-dark)]/80 py-4 backdrop-blur-md'
          : 'bg-transparent py-6'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="group flex cursor-pointer items-center gap-2"
        >
          <div className="flex h-8 w-8 rotate-45 items-center justify-center rounded-sm bg-[var(--color-relief-red)] transition-transform duration-500 group-hover:rotate-90">
            <Shield className="h-5 w-5 -rotate-45 text-white transition-transform duration-500 group-hover:-rotate-90" />
          </div>
          <span className="text-xl font-semibold uppercase tracking-tight">ReliefOS AI</span>
        </button>

        <div className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
          <a href="#platform" className="transition-colors hover:text-white">
            Platform
          </a>
          <a href="#capabilities" className="transition-colors hover:text-white">
            Solutions
          </a>
          <a href="#intelligence" className="transition-colors hover:text-white">
            Intelligence
          </a>
          <a href="#footer" className="transition-colors hover:text-white">
            Docs
          </a>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onAuthClick('signin')}
            className="hidden text-sm font-medium text-white/80 transition-colors hover:text-white sm:block"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => onAuthClick('signup')}
            className="hidden rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 sm:block"
          >
            Get Started
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            className="text-white md:hidden"
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            className="mx-4 mt-3 rounded-3xl border border-white/10 bg-[var(--color-relief-dark)]/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-xl md:hidden"
          >
            <div className="flex flex-col gap-2 text-sm font-medium text-white/80">
              <a
                href="#platform"
                onClick={closeMobileMenu}
                className="rounded-2xl px-4 py-3 transition-colors hover:bg-white/6 hover:text-white"
              >
                Platform
              </a>
              <a
                href="#capabilities"
                onClick={closeMobileMenu}
                className="rounded-2xl px-4 py-3 transition-colors hover:bg-white/6 hover:text-white"
              >
                Solutions
              </a>
              <a
                href="#intelligence"
                onClick={closeMobileMenu}
                className="rounded-2xl px-4 py-3 transition-colors hover:bg-white/6 hover:text-white"
              >
                Intelligence
              </a>
              <a
                href="#footer"
                onClick={closeMobileMenu}
                className="rounded-2xl px-4 py-3 transition-colors hover:bg-white/6 hover:text-white"
              >
                Docs
              </a>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  onAuthClick('signin');
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/8"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  closeMobileMenu();
                  onAuthClick('signup');
                }}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90"
              >
                Get Started
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

function AuthModal({
  mode,
  onClose,
}: {
  mode: Exclude<AuthMode, null>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { loading, error, doLogin, doRegister } = useAuth();
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [signUpForm, setSignUpForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'citizen' as RoleOption,
  });

  useEffect(() => {
    setFormError(null);
    setFocusedInput(null);
  }, [mode]);

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    try {
      await doLogin(signInForm.email, signInForm.password);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);

    try {
      await doRegister(signUpForm.name, signUpForm.email, signUpForm.password, signUpForm.role);
      onClose();
      navigate('/dashboard');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
    >
      <motion.div
        variants={authContainerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        onClick={(event) => event.stopPropagation()}
        className="glass relative max-h-[calc(100svh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl p-6 text-white sm:p-8"
      >
        <div className="pointer-events-none absolute right-0 top-0 -mr-20 -mt-20 h-40 w-40 rounded-full bg-[var(--color-relief-red)]/10 blur-[60px]" />

        <motion.button
          whileHover={{ rotate: 90, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="absolute right-4 top-4 z-10 p-2 text-white/40 transition-colors hover:text-white"
          type="button"
        >
          <X className="h-5 w-5" />
        </motion.button>

        <motion.div variants={modalItemVariants} className="relative mb-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-relief-red)]/20 bg-[var(--color-relief-red)]/10"
          >
            <Shield className="h-6 w-6 text-[var(--color-relief-orange)]" />
          </motion.div>
          <h3 className="font-serif text-2xl font-bold mb-2">
            {mode === 'signin' ? 'Welcome Back' : 'Join ReliefOS AI'}
          </h3>
          <p className="text-sm font-light text-white/60">
            {mode === 'signin'
              ? 'Access your mission control layer'
              : 'Deploy the intelligence layer for your organization'}
          </p>
        </motion.div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
            {(formError || error) && (
              <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {formError || error}
              </div>
            )}

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-4">
                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Email Address
                  </label>
                  <div
                    className={`group relative transition-all duration-300 ${
                      focusedInput === 'email' ? 'scale-[1.02]' : ''
                    }`}
                  >
                    <motion.div
                      animate={{
                        color:
                          focusedInput === 'email'
                            ? 'rgba(139, 0, 0, 1)'
                            : 'rgba(255, 255, 255, 0.2)',
                        scale: focusedInput === 'email' ? 1.2 : 1,
                      }}
                      className="absolute left-4 top-1/2 z-10 -translate-y-1/2"
                    >
                      <Mail className="h-4 w-4" />
                    </motion.div>
                    <input
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                      type="email"
                      required
                      value={signInForm.email}
                      onChange={(event) =>
                        setSignInForm((current) => ({ ...current, email: event.target.value }))
                      }
                      placeholder="name@organization.gov"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/35 transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none"
                    />
                  </div>
                </motion.div>

                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Password
                  </label>
                  <div
                    className={`group relative transition-all duration-300 ${
                      focusedInput === 'password' ? 'scale-[1.02]' : ''
                    }`}
                  >
                    <motion.div
                      animate={{
                        color:
                          focusedInput === 'password'
                            ? 'rgba(139, 0, 0, 1)'
                            : 'rgba(255, 255, 255, 0.2)',
                        scale: focusedInput === 'password' ? 1.2 : 1,
                      }}
                      className="absolute left-4 top-1/2 z-10 -translate-y-1/2"
                    >
                      <Lock className="h-4 w-4" />
                    </motion.div>
                    <input
                      onFocus={() => setFocusedInput('password')}
                      onBlur={() => setFocusedInput(null)}
                      type="password"
                      required
                      value={signInForm.password}
                      onChange={(event) =>
                        setSignInForm((current) => ({ ...current, password: event.target.value }))
                      }
                      placeholder="••••••••"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-sm text-white placeholder:text-white/35 transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none"
                    />
                  </div>
                </motion.div>

                <motion.button
                  variants={modalItemVariants}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-relief-red)] py-4 font-bold text-white shadow-xl shadow-[var(--color-relief-red)]/20 transition-all hover:bg-[var(--color-relief-red)]/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Accessing...' : 'Access Mission Control'}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={signUpForm.name}
                    onChange={(event) =>
                      setSignUpForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="ReliefOS Operator"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white placeholder:text-white/35 transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none"
                  />
                </motion.div>

                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={signUpForm.email}
                    onChange={(event) =>
                      setSignUpForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="name@organization.gov"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white placeholder:text-white/35 transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none"
                  />
                </motion.div>

                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={signUpForm.password}
                    onChange={(event) =>
                      setSignUpForm((current) => ({ ...current, password: event.target.value }))
                    }
                    placeholder="Create a secure password"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white placeholder:text-white/35 transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none"
                  />
                </motion.div>

                <motion.div variants={modalItemVariants} className="space-y-2">
                  <label className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    Role
                  </label>
                  <select
                    value={signUpForm.role}
                    onChange={(event) =>
                      setSignUpForm((current) => ({
                        ...current,
                        role: event.target.value as RoleOption,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white transition-all focus:border-[var(--color-relief-red)]/50 focus:bg-white/[0.08] focus:outline-none [&>option]:bg-[var(--color-relief-dark)] [&>option]:text-white"
                  >
                    <option value="citizen">Citizen</option>
                    <option value="rescue_team">Rescue Team</option>
                    <option value="admin">Admin</option>
                  </select>
                </motion.div>

                <motion.button
                  variants={modalItemVariants}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="group mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-relief-red)] py-4 font-bold text-white shadow-xl shadow-[var(--color-relief-red)]/20 transition-all hover:bg-[var(--color-relief-red)]/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? 'Deploying...' : 'Deploy Intelligence'}
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </motion.button>
              </form>
            )}
        </motion.div>

      </motion.div>
    </motion.div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const { isLoggedIn, doLogout } = useAuth();
  const [authMode, setAuthMode] = useState<AuthMode>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [activeCapability, setActiveCapability] = useState<string>(capabilityItems[0].title);

  useEffect(() => {
    const handlePointerMove = (event: MouseEvent) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      setPointer({ x, y });
    };

    window.addEventListener('mousemove', handlePointerMove);
    return () => window.removeEventListener('mousemove', handlePointerMove);
  }, []);

  return (
    <div className="noise min-h-screen overflow-x-hidden selection:bg-[var(--color-relief-red)]/30 focus-within:outline-none">
      <Navbar onAuthClick={setAuthMode} />

      <AnimatePresence>
        {authMode && <AuthModal mode={authMode} onClose={() => setAuthMode(null)} />}
      </AnimatePresence>

      <section
        id="platform"
        className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 pb-16 pt-28 sm:px-6 sm:pb-10"
      >
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 z-10 bg-gradient-to-b from-[var(--color-relief-dark)]/10 via-[var(--color-relief-dark)]/35 to-[var(--color-relief-dark)]" />
          <motion.div
            animate={{
              backgroundPosition: [
                '50% 35%, 20% 20%, 80% 18%',
                '52% 34%, 18% 22%, 82% 16%',
                '50% 35%, 20% 20%, 80% 18%',
              ],
            }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_35%,rgba(255,106,64,0.22),transparent_22%),radial-gradient(circle_at_20%_20%,rgba(139,0,0,0.3),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(255,69,0,0.18),transparent_24%)]"
          />
          <motion.img
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{
              scale: 1.04,
              opacity: 0.54,
              x: pointer.x * -18,
              y: pointer.y * -18,
            }}
            transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
            src="https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&q=80&w=2000"
            alt="Space cinematic background"
            className="h-full w-full object-cover saturate-150 hue-rotate-[-12deg] contrast-125 brightness-[0.7]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{
                opacity: 0.3,
                scale: 1,
                x: pointer.x * 28,
                y: pointer.y * 20,
              }}
              transition={{ duration: 1.5 }}
              className="h-[520px] w-[520px] rounded-full bg-[var(--color-relief-red)]/20 blur-[120px] sm:h-[800px] sm:w-[800px]"
            />
          </div>
          <motion.div
            animate={{ opacity: [0.18, 0.3, 0.18], scale: [1, 1.08, 1] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-x-[12%] bottom-[8%] z-10 h-[34%] rounded-full bg-[radial-gradient(circle,rgba(255,82,36,0.42),rgba(255,82,36,0.08)_46%,transparent_70%)] blur-[80px]"
          />
          <motion.div
            animate={{
              x: pointer.x * -34,
              y: pointer.y * -16,
              opacity: [0.18, 0.28, 0.18],
            }}
            transition={{
              x: { type: 'spring', stiffness: 40, damping: 18 },
              y: { type: 'spring', stiffness: 40, damping: 18 },
              opacity: { duration: 7, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="absolute left-[10%] top-[18%] z-10 h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(255,188,120,0.22),transparent_70%)] blur-[70px] sm:h-56 sm:w-56"
          />
        </div>

        <motion.div
          animate={{
            x: pointer.x * 10,
            y: pointer.y * 8,
          }}
          transition={{ type: 'spring', stiffness: 36, damping: 18 }}
          className="relative z-20 w-full max-w-4xl"
        >
          <motion.div
            initial="hidden"
            animate="visible"
            variants={heroContainerVariants}
            className="space-y-6 text-center sm:space-y-8"
          >
              <motion.div
                variants={fadeUpVariants}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 backdrop-blur-sm"
              >
                <Radio className="h-3 w-3 animate-pulse text-[var(--color-relief-orange)]" />
                <span className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/60">
                  ReliefOS AI
                </span>
              </motion.div>

              <motion.h1
                variants={heroHeadlineVariants}
                className="text-glow font-serif text-4xl font-bold leading-[0.92] tracking-tight sm:text-5xl md:text-8xl"
              >
                Unified crisis <br />
                <span className="italic text-[var(--color-relief-orange)]">response</span> command.
              </motion.h1>

              <motion.p
                variants={fadeUpVariants}
                className="mx-auto max-w-2xl text-base leading-7 text-white/50 font-light sm:text-lg md:text-xl"
              >
                Crisis intelligence, resource coordination, and emergency response in one platform.
              </motion.p>

              <motion.div
                variants={fadeUpVariants}
                className="flex flex-col items-stretch justify-center gap-3 pt-2 sm:flex-row sm:items-center sm:gap-4 sm:pt-4"
              >
                <button
                  type="button"
                  onClick={() => (isLoggedIn ? navigate('/dashboard') : setAuthMode('signup'))}
                  className="red-glow group flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--color-relief-red)] px-6 py-4 font-bold text-white transition-all duration-300 hover:scale-105 active:scale-95 sm:w-auto sm:px-8"
                >
                  {isLoggedIn ? 'Open Dashboard' : 'Get Started'}
                  <Zap className="h-4 w-4 transition-transform group-hover:rotate-12" />
                </button>
                {isLoggedIn ? (
                  <button
                    type="button"
                    onClick={() => navigate('/crisis-map')}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-4 font-bold text-white backdrop-blur-sm transition-all hover:bg-white/10 active:scale-95 sm:w-auto sm:px-8"
                  >
                    Open Crisis Map
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthMode('signin')}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-6 py-4 font-bold text-white backdrop-blur-sm transition-all hover:bg-white/10 active:scale-95 sm:w-auto sm:px-8"
                  >
                    Sign In
                  </button>
                )}
              </motion.div>

              <motion.div
                variants={fadeUpVariants}
                className="mx-auto grid max-w-3xl gap-3 pt-2 sm:grid-cols-3 sm:pt-4"
              >
                {heroSignalCards.map((card, index) => (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.75 + index * 0.08, duration: 0.6 }}
                    whileHover={{ y: -4, backgroundColor: 'rgba(255,255,255,0.08)' }}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-left backdrop-blur-md"
                  >
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">{card.label}</div>
                    <div className={`mt-2 text-2xl font-semibold ${card.accent}`}>{card.value}</div>
                  </motion.div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 0.7, ease: cinematicEase }}
                className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 pt-1 sm:gap-3 sm:pt-2"
              >
                {['Live crisis intelligence', 'Resource allocation', 'Emergency coordination'].map((item, index) => (
                  <motion.div
                    key={item}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ duration: 4 + index, repeat: Infinity, ease: 'easeInOut', delay: index * 0.3 }}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-white/58 backdrop-blur-sm sm:px-4 sm:text-xs"
                  >
                    {item}
                  </motion.div>
                ))}
              </motion.div>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-4 sm:flex"
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/30">
            Scroll to explore
          </span>
          <div className="h-12 w-[1px] bg-gradient-to-b from-white/20 to-transparent" />
        </motion.div>
      </section>

      <section id="capabilities" className="relative overflow-hidden bg-white/2 px-4 py-20 sm:px-6 sm:py-32">
        <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="mx-auto max-w-7xl">
          <div className="mb-12 space-y-4 text-center sm:mb-20">
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-relief-orange)]">
              Capabilities
            </span>
            <h2 className="font-serif text-3xl font-bold sm:text-4xl md:text-6xl">Integrated intelligence.</h2>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, ease: cinematicEase }}
              className="mx-auto max-w-2xl text-base leading-8 text-white/46"
            >
              Move through the platform layer by layer. Each surface is tuned for faster decisions under pressure.
            </motion.p>
          </div>

          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="grid overflow-hidden rounded-3xl border border-white/5 bg-white/5 md:grid-cols-3 gap-px">
            {capabilityItems.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.01 }}
                onHoverStart={() => setActiveCapability(feature.title)}
                className="group relative bg-[var(--color-relief-dark)] p-6 transition-all duration-500 hover:bg-white/[0.02] sm:p-10"
              >
                <div className="absolute right-8 top-8 text-white/5 transition-colors duration-500 group-hover:text-[var(--color-relief-red)]">
                  <feature.icon className="h-16 w-16 stroke-[1]" />
                </div>
                <div className="relative z-10 space-y-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 transition-all duration-300 group-hover:bg-[var(--color-relief-red)]/10 group-hover:red-glow">
                    <feature.icon className="h-5 w-5 text-white/40 transition-colors group-hover:text-[var(--color-relief-orange)]" />
                  </div>
                  <h3 className="text-xl font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-white/40">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
            </div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.75, ease: cinematicEase }}
              className="relative overflow-hidden rounded-3xl border border-white/8 bg-white/[0.04] p-6 sm:p-8"
            >
              <motion.div
                animate={{ opacity: [0.22, 0.4, 0.22], scale: [1, 1.06, 1] }}
                transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
                className="pointer-events-none absolute right-[-40px] top-[-30px] h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(255,106,64,0.26),transparent_68%)] blur-3xl"
              />
              <div className="relative z-10">
                <div className="text-[10px] uppercase tracking-[0.28em] text-white/34">Interactive Focus</div>
                <div className="mt-4 text-2xl font-semibold text-white">{activeCapability}</div>
                <p className="mt-4 text-sm leading-7 text-white/50">
                  {capabilityItems.find((item) => item.title === activeCapability)?.desc}
                </p>

                <div className="mt-8 space-y-3">
                  {capabilityItems.map((item, index) => (
                    <motion.button
                      key={item.title}
                      type="button"
                      onMouseEnter={() => setActiveCapability(item.title)}
                      whileHover={{ x: 6 }}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        activeCapability === item.title
                          ? 'border-white/16 bg-white/[0.07] text-white'
                          : 'border-white/8 bg-black/10 text-white/52 hover:text-white/76'
                      }`}
                    >
                      <span className="text-sm font-medium">{item.title}</span>
                      <ChevronRight className={`h-4 w-4 transition-transform ${activeCapability === item.title ? 'translate-x-1' : ''}`} />
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section id="intelligence" className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-40">
        <div className="absolute inset-0 z-0">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-[var(--color-relief-red)]/30 opacity-40 blur-[150px]" />
        </div>

        <div className="relative z-10 mx-auto max-w-4xl space-y-10 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: cinematicEase }}
            className="font-serif text-3xl font-bold italic leading-tight sm:text-4xl md:text-7xl"
          >
            The next generation of <br /> mission control is here.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, delay: 0.1, ease: cinematicEase }}
            className="text-base font-light text-white/50 sm:text-xl"
          >
            ReliefOS AI is available for governmental agencies and certified global NGOs.
            Deploy your secure intelligence layer today.
          </motion.p>
          <div className="flex flex-col items-center justify-center gap-6 pt-6 sm:flex-row">
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className="rounded-full bg-white px-8 py-4 font-bold text-black transition-transform hover:scale-105 sm:px-10 sm:py-5"
            >
              Apply for Deployment
            </button>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors hover:text-[var(--color-relief-orange)]"
              >
                Open Dashboard
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <a
                href="#platform"
                className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors hover:text-[var(--color-relief-orange)]"
              >
                Read the Whitepaper
                <ChevronRight className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      </section>

      <footer id="footer" className="border-t border-white/5 bg-black/20 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 sm:gap-12 md:flex-row">
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--color-relief-orange)]" />
              <span className="text-lg font-bold uppercase tracking-tight">ReliefOS AI</span>
            </div>
            <p className="max-w-xs text-sm text-white/30">
              Unified crisis intelligence layer. Built for the unknown.
            </p>
            {isLoggedIn ? (
              <button
                type="button"
                onClick={doLogout}
                className="text-xs font-bold uppercase tracking-[0.2em] text-white/40 transition-colors hover:text-white"
              >
                Sign Out
              </button>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-24">
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                Protocol
              </h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li>
                  <a href="#platform" className="transition-colors hover:text-white">
                    Security
                  </a>
                </li>
                <li>
                  <a href="#capabilities" className="transition-colors hover:text-white">
                    Compliance
                  </a>
                </li>
                <li>
                  <a href="#intelligence" className="transition-colors hover:text-white">
                    Edge Nodes
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                Intelligence
              </h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li>
                  <a href="#platform" className="transition-colors hover:text-white">
                    Models
                  </a>
                </li>
                <li>
                  <a href="#capabilities" className="transition-colors hover:text-white">
                    Training
                  </a>
                </li>
                <li>
                  <a href="#intelligence" className="transition-colors hover:text-white">
                    Ground Truth
                  </a>
                </li>
              </ul>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-white/20">
                Agency
              </h4>
              <ul className="space-y-2 text-sm text-white/50">
                <li>
                  <button
                    type="button"
                    onClick={() => setAuthMode('signup')}
                    className="transition-colors hover:text-white"
                  >
                    Apply
                  </button>
                </li>
                <li>
                  <a href="#capabilities" className="transition-colors hover:text-white">
                    NGO Tier
                  </a>
                </li>
                <li>
                  <a href="#intelligence" className="transition-colors hover:text-white">
                    Government
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 pt-14 text-[10px] font-medium uppercase tracking-[0.2em] text-white/20 sm:pt-20 sm:flex-row">
          <span>© 2026 ReliefOS Global Intelligence. All Rights Reserved.</span>
          <div className="flex gap-8">
            <a href="#footer" className="hover:text-white">
              Terms of Service
            </a>
            <a href="#footer" className="hover:text-white">
              Privacy Architecture
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
