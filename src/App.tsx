import React, { useState, useEffect, useMemo } from 'react';
import {
    Calendar as CalendarIcon,
    Calculator,
    Trash2,
    Plus,
    Info,
    CheckCircle2,
    AlertCircle,
    Sun,
    Moon
} from 'lucide-react';
import { format, getDaysInMonth, isWeekend, isSameDay, getDate, getDay, getMonth, getYear, startOfMonth, eachDayOfInterval, endOfMonth, isFriday, isSaturday, isSunday } from 'date-fns';
import { cs } from 'date-fns/locale';

// --- UI COMPONENTS (Simplified versions of shadcn/ui for portability) ---
// In a real project, import these from @/components/ui/...

const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
    <div
        className={
            `rounded-xl border border-slate-200 dark:border-slate-700
             bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50
             shadow-sm ${className}`
        }
    >
        {children}
    </div>
);

const CardHeader = ({ children }: { children: React.ReactNode }) => <div className="flex flex-col space-y-1.5 p-6">{children}</div>;
const CardTitle = ({ children }: { children: React.ReactNode }) => <h3 className="text-2xl font-semibold leading-none tracking-tight">{children}</h3>;
const CardContent = ({ children, className="" }: { children: React.ReactNode, className?: string }) => <div className={`p-6 pt-0 ${className}`}>{children}</div>;

const Label = ({ children, className="" }: { children: React.ReactNode, className?: string }) => (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
        {...props}
        className={
            "flex h-10 w-full rounded-md border " +
            "border-slate-200 dark:border-slate-700 " +
            "bg-white dark:bg-slate-900 " +
            "px-3 py-2 text-sm " +
            "text-slate-900 dark:text-slate-50 " +
            "placeholder:text-slate-400 dark:placeholder:text-slate-500 " +
            "focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-slate-500 dark:focus-visible:ring-slate-400 " +
            "focus-visible:ring-offset-2 " +
            "focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950 " +
            "disabled:cursor-not-allowed disabled:opacity-50"
        }
    />
);


const Button = ({ children, variant = "default", size = "default", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "destructive" | "ghost", size?: "default" | "sm" | "icon" }) => {
    const base = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";
    const variants = {
        default: "bg-slate-900 text-white hover:bg-slate-900/90",
        outline:
            "border border-slate-200 dark:border-slate-700 " +
            "bg-white dark:bg-slate-900 " +
            "text-slate-900 dark:text-slate-50 " +
            "hover:bg-slate-100 dark:hover:bg-slate-800",
        destructive: "bg-red-500 text-white hover:bg-red-500/90",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-50",
    };

    const sizes = {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        icon: "h-10 w-10"
    };
    return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
};

// --- BUSINESS LOGIC & UTILS ---

/**
 * Calculates the date of Easter Sunday for a given year using the anonymous algorithm (Meeus/Jones/Butcher).
 */
const getEasterSunday = (year: number): Date => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day);
};

/**
 * Checks if a given date is a Czech public holiday.
 */
const isCzechHoliday = (date: Date): boolean => {
    const d = getDate(date);
    const m = getMonth(date); // 0 = Jan
    const y = getYear(date);

    // Fixed Holidays
    const fixedHolidays = [
        { d: 1, m: 0 },   // 1.1. Nový rok
        { d: 1, m: 4 },   // 1.5. Svátek práce
        { d: 8, m: 4 },   // 8.5. Den vítězství
        { d: 5, m: 6 },   // 5.7. Cyril a Metoděj
        { d: 6, m: 6 },   // 6.7. Jan Hus
        { d: 28, m: 8 },  // 28.9. Sv. Václav
        { d: 28, m: 9 },  // 28.10. Vznik ČSR
        { d: 17, m: 10 }, // 17.11. Den boje za svobodu
        { d: 24, m: 11 }, // 24.12. Štědrý den
        { d: 25, m: 11 }, // 25.12. 1. svátek vánoční
        { d: 26, m: 11 }, // 26.12. 2. svátek vánoční
    ];

    if (fixedHolidays.some(h => h.d === d && h.m === m)) return true;

    // Easter Related (Movable)
    const easterSunday = getEasterSunday(y);

    // Good Friday (Velký pátek) is 2 days before Easter Sunday
    const goodFriday = new Date(easterSunday);
    goodFriday.setDate(easterSunday.getDate() - 2);
    if (isSameDay(date, goodFriday)) return true;

    // Easter Monday (Velikonoční pondělí) is 1 day after Easter Sunday
    const easterMonday = new Date(easterSunday);
    easterMonday.setDate(easterSunday.getDate() + 1);
    if (isSameDay(date, easterMonday)) return true;

    return false;
};

/**
 * Calculates standard monthly working hours (Weekdays * 8).
 */
const calculateStandardMonthlyHours = (date: Date): number => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    const workingDays = days.filter(d => !isWeekend(d)); // Simplified: All Mon-Fri are working days for contract base
    return workingDays.length * 8;
};

// --- TYPES ---

type ProfileType = 'devops' | 'other' | 'custom';

interface SelectedDay {
    date: string; // ISO string
    type: 'full' | 'handoff'; // 'full' = Standard logic, 'handoff' = 00:00 to 09:00
}

interface AppState {
    monthlySalary: number;
    selectedDate: string;
    monthlyHoursOverride: number | null;
    profile: ProfileType;
    customRates: {
        onCall: number;
        otNormal: number;
        otHoliday: number;
    };
    // CHANGE THIS LINE:
    selectedOnCallDates: SelectedDay[];
    workLogs: WorkLog[];
}

interface AppState {
    monthlySalary: number;
    selectedDate: string; // ISO string for month selection
    monthlyHoursOverride: number | null;
    profile: ProfileType;
    customRates: {
        onCall: number;
        otNormal: number;
        otHoliday: number;
    };
    selectedOnCallDates: string[]; // ISO strings
    workLogs: WorkLog[];
}

interface WorkLog {
    id: string;
    date: string; // ISO Date string
    hours: number;
    isHolidayOverride: boolean; // User manually overrides detection
}

// --- MAIN COMPONENT ---
type Theme = 'light' | 'dark';
export default function OnCallCalculator() {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === 'undefined') return 'light';
        const stored = window.localStorage.getItem('theme');
        if (stored === 'light' || stored === 'dark') return stored;
        return window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        window.localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
    };

    // --- STATE ---
    const [state, setState] = useState<AppState>(() => {
        const saved = localStorage.getItem('oncall-calc-state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed.selectedOnCallDates) && typeof parsed.selectedOnCallDates[0] === 'string') {
                    parsed.selectedOnCallDates = parsed.selectedOnCallDates.map((d: string) => ({
                        date: d,
                        type: 'full'
                    }));
                }
                return parsed;
            } catch (e) { console.error("Failed to load state", e); }
        }
        return {
            monthlySalary: 80000,
            selectedDate: new Date().toISOString(),
            monthlyHoursOverride: null,
            profile: 'devops',
            customRates: { onCall: 0.2, otNormal: 0.5, otHoliday: 1.5 },
            selectedOnCallDates: [], // Now an empty array of SelectedDay objects
            workLogs: []
        };
    });

    // Persist to local storage
    useEffect(() => {
        localStorage.setItem('oncall-calc-state', JSON.stringify(state));
    }, [state]);

    // Derived values
    const currentDate = new Date(state.selectedDate);
    const year = getYear(currentDate);
    const month = getMonth(currentDate);

    const standardMonthlyHours = useMemo(() =>
            calculateStandardMonthlyHours(currentDate),
        [currentDate]);

    const effectiveMonthlyHours = state.monthlyHoursOverride || standardMonthlyHours;
    const hourlyWage = effectiveMonthlyHours > 0 ? state.monthlySalary / effectiveMonthlyHours : 0;

    // Rates based on profile
    const rates = useMemo(() => {
        if (state.profile === 'custom') return state.customRates;
        if (state.profile === 'devops') return { onCall: 0.2, otNormal: 0.5, otHoliday: 1.5 };
        return { onCall: 0.1, otNormal: 0.5, otHoliday: 1.5 }; // 'other'
    }, [state.profile, state.customRates]);

    // --- HANDLERS ---

    const toggleDate = (day: Date) => {
        const existingIndex = state.selectedOnCallDates.findIndex(d => isSameDay(new Date(d.date), day));

        let newSelection = [...state.selectedOnCallDates];

        if (existingIndex >= 0) {
            const currentItem = newSelection[existingIndex];

            if (currentItem.type === 'full') {
                // Switch to Handoff (00:00 - 09:00)
                newSelection[existingIndex] = { ...currentItem, type: 'handoff' };
            } else {
                // If it was already handoff, remove it
                newSelection.splice(existingIndex, 1);
            }
        } else {
            // Add as Full shift
            newSelection.push({ date: day.toISOString(), type: 'full' });
        }

        setState(prev => ({
            ...prev,
            selectedOnCallDates: newSelection
        }));
    };

    const addWorkLog = () => {
        setState(prev => ({
            ...prev,
            workLogs: [
                ...prev.workLogs,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    date: new Date().toISOString(),
                    hours: 0,
                    isHolidayOverride: false
                }
            ]
        }));
    };

    const updateWorkLog = (id: string, field: keyof WorkLog, value: any) => {
        setState(prev => ({
            ...prev,
            workLogs: prev.workLogs.map(log => log.id === id ? { ...log, [field]: value } : log)
        }));
    };

    const removeWorkLog = (id: string) => {
        setState(prev => ({
            ...prev,
            workLogs: prev.workLogs.filter(l => l.id !== id)
        }));
    };

    // --- CALCULATOR ENGINE ---

    const calculation = useMemo(() => {
        let totalStandbyHours = 0;
        let totalWorkNormal = 0;
        let totalWorkHoliday = 0;

        // 1. Calculate Potential Standby Hours from Schedule
        state.selectedOnCallDates.forEach(item => {
            const date = new Date(item.date);

            // NEW LOGIC: Check for Handoff
            if (item.type === 'handoff') {
                // Handoff is strictly 00:00 to 09:00 = 9 hours
                totalStandbyHours += 9;
                return; // Skip the standard logic for this day
            }

            // Standard Logic ('full')
            const isHoliday = isCzechHoliday(date);
            const isWe = isWeekend(date);

            if (isHoliday || isWe) {
                totalStandbyHours += 24;
            } else {
                // Regular weekday: 17:00 - 09:00
                totalStandbyHours += 16;
            }
        });

        // 2. Process Work Logs (Overtime)
        let totalWorkDuration = 0;

        state.workLogs.forEach(log => {
            const logDate = new Date(log.date);
            const autoHoliday = isCzechHoliday(logDate);
            const isHoliday = autoHoliday || log.isHolidayOverride;

            if (isHoliday) {
                totalWorkHoliday += log.hours;
            } else {
                totalWorkNormal += log.hours;
            }
            totalWorkDuration += log.hours;
        });

        // 3. Adjust Standby (Standby - Work = Paid Standby)
        // "Work hours during on-call should be counted only as overtime, not standby."
        // We subtract total work done from the total standby bucket.
        const paidStandbyHours = Math.max(0, totalStandbyHours - totalWorkDuration);

        // 4. Financials
        const onCallFee = paidStandbyHours * hourlyWage * rates.onCall;
        const overtimeNormalPay = totalWorkNormal * hourlyWage * (1 + rates.otNormal);
        const overtimeHolidayPay = totalWorkHoliday * hourlyWage * (1 + rates.otHoliday);
        const totalExtra = onCallFee + overtimeNormalPay + overtimeHolidayPay;

        return {
            paidStandbyHours,
            totalWorkNormal,
            totalWorkHoliday,
            onCallFee,
            overtimeNormalPay,
            overtimeHolidayPay,
            totalExtra,
            hourlyWage
        };
    }, [state.selectedOnCallDates, state.workLogs, hourlyWage, rates]);

    // --- CALENDAR RENDERING HELPER ---
    const renderCalendar = () => {
        const days = eachDayOfInterval({
            start: startOfMonth(currentDate),
            end: endOfMonth(currentDate)
        });

        const startDay = getDay(days[0]);
        const offset = startDay === 0 ? 6 : startDay - 1;
        const empties = Array(offset).fill(null);
        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        return (
            <div className="space-y-2">
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-gray-500 dark:text-slate-400">
                    {weekDays.map(d => <div key={d}>{d}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {empties.map((_, i) => <div key={`empty-${i}`} />)}
                    {days.map(day => {
                        // FIND THE SELECTION OBJECT
                        const selection = state.selectedOnCallDates.find(d => isSameDay(new Date(d.date), day));
                        const isSelected = !!selection;

                        const isHoliday = isCzechHoliday(day);
                        const isWe = isWeekend(day);

                        const baseClasses =
                            "h-10 w-full rounded-md border text-sm flex items-center justify-center relative transition-all";

                        // default
                        let bgClass =
                            "bg-white text-slate-900 hover:bg-slate-100 border-gray-200 " +
                            "dark:bg-slate-800 dark:text-slate-50 dark:border-slate-700 dark:hover:bg-slate-700";

                        if (isSelected) {
                            if (selection.type === 'handoff') {
                                // NEW STYLE: Handoff Day (Orange)
                                bgClass =
                                    "bg-orange-100 text-orange-900 border-orange-500 hover:bg-orange-200 " +
                                    "dark:bg-orange-900/60 dark:text-orange-100 dark:border-orange-500 dark:hover:bg-orange-900";
                            } else if (isHoliday) {
                                // Selected holiday
                                bgClass =
                                    "bg-purple-100 text-purple-900 border-purple-500 hover:bg-purple-200 " +
                                    "dark:bg-purple-900/60 dark:text-purple-100 dark:border-purple-500 dark:hover:bg-purple-900";
                            } else if (isWe) {
                                // Selected weekend
                                bgClass =
                                    "bg-blue-100 text-blue-900 border-blue-500 hover:bg-blue-200 " +
                                    "dark:bg-blue-900/60 dark:text-blue-100 dark:border-blue-500 dark:hover:bg-blue-900";
                            } else {
                                // Selected weekday
                                bgClass =
                                    "bg-slate-900 text-white hover:bg-slate-800 border-slate-900 " +
                                    "dark:bg-slate-50 dark:text-slate-900 dark:border-slate-50 dark:hover:bg-slate-200";
                            }
                        } else if (isHoliday) {
                            bgClass =
                                "bg-red-50 text-red-600 border-red-100 " +
                                "dark:bg-red-900/50 dark:text-red-200 dark:border-red-700";
                        }

                        return (
                            <button
                                key={day.toISOString()}
                                onClick={() => toggleDate(day)}
                                className={`${baseClasses} ${bgClass}`}
                            >
                                {getDate(day)}
                                {selection?.type === 'handoff' && (
                                    <span className="absolute bottom-0.5 text-[8px] font-bold uppercase">End</span>
                                )}
                                {isHoliday && !selection && (
                                    <span className="absolute top-0 right-0.5 text-[10px] leading-none text-current opacity-70">●</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Updated Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-slate-400 mt-2 justify-center">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-slate-900 dark:bg-slate-50 rounded" />
                        Full Shift
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-orange-100 border border-orange-500 dark:bg-orange-900/60 rounded" />
                        Handoff (Morning only)
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-purple-100 border border-purple-500 dark:bg-purple-900/60 rounded" />
                        Holiday
                    </div>
                </div>
            </div>
        );
    };

    // --- RENDER ---

    return (
        <div className={theme === 'dark' ? 'dark' : ''}>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 font-sans text-slate-900 dark:text-slate-50 transition-colors">
                {/* Top bar with title + theme switch */}
                <div className="max-w-6xl mx-auto mb-6 flex items-center justify-between">
                    <h1 className="text-xl font-semibold">
                        On-Call Calculator
                    </h1>

                    <button
                        onClick={toggleTheme}
                        className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur hover:bg-white dark:hover:bg-slate-800 transition-colors"
                    >
                        {theme === 'dark' ? (
                            <>
                                <Sun className="w-4 h-4" />
                                <span>Light mode</span>
                            </>
                        ) : (
                            <>
                                <Moon className="w-4 h-4" />
                                <span>Dark mode</span>
                            </>
                        )}
                    </button>
                </div>

            <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* LEFT COLUMN: INPUTS */}
                <div className="lg:col-span-7 space-y-6">

                    {/* 1. BASE SETTINGS */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5" /> Base Salary & Month
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Gross Monthly Salary (CZK)</Label>
                                <Input
                                    type="number"
                                    value={state.monthlySalary}
                                    onChange={e => setState({...state, monthlySalary: Number(e.target.value)})}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Month</Label>
                                <Input
                                    type="month"
                                    value={state.selectedDate.slice(0, 7)}
                                    onChange={e => {
                                        if(e.target.value) setState({...state, selectedDate: new Date(e.target.value).toISOString()});
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Monthly Hours (Standard)</Label>
                                <div className="relative">
                                    <Input
                                        type="number"
                                        value={effectiveMonthlyHours}
                                        onChange={e => setState({...state, monthlyHoursOverride: Number(e.target.value)})}
                                    />
                                    {state.monthlyHoursOverride !== null && state.monthlyHoursOverride !== standardMonthlyHours && (
                                        <button
                                            onClick={() => setState({...state, monthlyHoursOverride: null})}
                                            className="absolute right-2 top-2 text-xs text-blue-600 underline"
                                        >
                                            Reset to {standardMonthlyHours}
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                    Base Hourly: {hourlyWage.toFixed(2)} CZK
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Role / Profile</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border
             border-slate-200 dark:border-slate-700
             bg-white dark:bg-slate-900
             px-3 py-2 text-sm
             text-slate-900 dark:text-slate-50"
                                    value={state.profile}
                                    onChange={(e) => setState({ ...state, profile: e.target.value as ProfileType })}
                                >

                                    <option value="devops">DevOps / Infra (20%)</option>
                                    <option value="other">Other Employee (10%)</option>
                                    <option value="custom">Custom...</option>
                                </select>
                            </div>

                            {state.profile === 'custom' && (
                                <div className="col-span-1 md:col-span-2 grid grid-cols-3 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                                <div>
                                        <Label className="text-xs">OnCall Rate</Label>
                                        <Input type="number" step="0.1" value={state.customRates.onCall} onChange={e => setState({...state, customRates: {...state.customRates, onCall: Number(e.target.value)}})} className="h-8 text-xs" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">OT Normal</Label>
                                        <Input type="number" step="0.1" value={state.customRates.otNormal} onChange={e => setState({...state, customRates: {...state.customRates, otNormal: Number(e.target.value)}})} className="h-8 text-xs" />
                                    </div>
                                    <div>
                                        <Label className="text-xs">OT Holiday</Label>
                                        <Input type="number" step="0.1" value={state.customRates.otHoliday} onChange={e => setState({...state, customRates: {...state.customRates, otHoliday: Number(e.target.value)}})} className="h-8 text-xs" />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* 2. SCHEDULE */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" /> On-Call Schedule
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground mb-4">
                                Select the days your shift <strong>starts</strong>.
                                <br/>• Mon-Fri: 17:00–09:00 (16h)
                                <br/>• Sat/Sun/Holidays: 24h
                            </p>
                            <div className="max-w-sm mx-auto">
                                {renderCalendar()}
                            </div>
                            <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-800 rounded text-sm flex justify-between">
                            <span>Selected Days: <strong>{state.selectedOnCallDates.length}</strong></span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. ACTUAL WORK */}
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" /> Work During On-Call
                                </CardTitle>
                                <Button size="sm" variant="outline" onClick={addWorkLog}><Plus className="w-4 h-4 mr-1"/> Add Log</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {state.workLogs.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm">
                                    No active work logs. Click "Add Log" if you worked during on-call.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {state.workLogs.map((log) => {
                                        const logDate = new Date(log.date);
                                        const isAutoHoliday = isCzechHoliday(logDate);
                                        return (
                                            <div
                                                key={log.id}
                                                className="flex flex-wrap md:flex-nowrap items-end gap-2 border p-3 rounded-md bg-white dark:bg-slate-900"
                                            >
                                            <div className="w-full md:w-auto flex flex-col gap-1">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">
                                                        Date
                                                    </Label>
                                                    <Input
                                                        type="date"
                                                        className="w-full md:w-40"
                                                        value={log.date.slice(0, 10)}
                                                        onChange={e =>
                                                            updateWorkLog(log.id, 'date', new Date(e.target.value).toISOString())
                                                        }
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <Label className="text-[10px] uppercase text-muted-foreground">Hours</Label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.5"
                                                        value={log.hours}
                                                        onChange={e => updateWorkLog(log.id, 'hours', Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="flex items-center h-10 pb-2 px-2">
                                                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-gray-300"
                                                            checked={isAutoHoliday || log.isHolidayOverride}
                                                            onChange={e => updateWorkLog(log.id, 'isHolidayOverride', e.target.checked)}
                                                        />
                                                        <span className={isAutoHoliday ? "text-purple-600 font-bold" : ""}>
                               {isAutoHoliday ? "Holiday (Auto)" : "Is Holiday?"}
                             </span>
                                                    </label>
                                                </div>
                                                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeWorkLog(log.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT COLUMN: SUMMARY */}
                {/* RIGHT COLUMN: SUMMARY */}
                <div className="lg:col-span-5">
                    <Card className="sticky top-8 border-slate-300 shadow-lg overflow-hidden flex flex-col">

                        {/* 1. Card Header */}
                        <div className="bg-slate-900 p-6 text-white">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Calculator className="w-6 h-6" /> Compensation Summary
                            </h2>
                            {/* CHANGE THIS LINE BELOW: Remove ", { locale: cs }" */}
                            <p className="text-slate-400 text-sm mt-1">
                                {format(currentDate, 'MMMM yyyy')}
                            </p>
                        </div>

                        {/* 2. Card Content */}
                        <div className="p-6 space-y-6 bg-white dark:bg-slate-900 flex-1 transition-colors">

                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                {/* Paid Standby */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-4 py-3 flex flex-col gap-1">
                                    <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
                                        Paid Standby
                                    </div>
                                    <div className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
                                        {calculation.paidStandbyHours.toLocaleString()} h
                                    </div>
                                </div>

                                {/* Base Hourly */}
                                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-4 py-3 flex flex-col gap-1">
                                    <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-slate-500 dark:text-slate-400">
                                        Base Hourly
                                    </div>
                                    <div className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                                        {calculation.hourlyWage.toFixed(0)} CZK
                                    </div>
                                </div>

                                {/* Work (Normal) */}
                                <div className="rounded-xl border border-blue-500/70 bg-blue-50 dark:bg-blue-950/50 px-4 py-3 flex flex-col gap-1">
                                    <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-blue-700 dark:text-blue-300">
                                        Work (Normal)
                                    </div>
                                    <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                                        {calculation.totalWorkNormal} h
                                    </div>
                                </div>

                                {/* Work (Holiday) */}
                                <div className="rounded-xl border border-purple-500/70 bg-purple-50 dark:bg-purple-950/50 px-4 py-3 flex flex-col gap-1">
                                    <div className="text-[11px] font-semibold tracking-[0.15em] uppercase text-purple-700 dark:text-purple-300">
                                        Work (Holiday)
                                    </div>
                                    <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                                        {calculation.totalWorkHoliday} h
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-200 my-4" />

                            {/* Financial Breakdown */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm">
                   <span className="flex items-center gap-2 text-slate-600">
                     <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                     Standby Fee <span className="text-xs bg-slate-100 px-1.5 rounded text-slate-500">{(rates.onCall * 100).toFixed(0)}%</span>
                   </span>
                                    <span className="font-mono font-medium">{calculation.onCallFee.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                   <span className="flex items-center gap-2 text-slate-600">
                     <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                     Overtime (Normal)
                   </span>
                                    <span className="font-mono font-medium">{calculation.overtimeNormalPay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                   <span className="flex items-center gap-2 text-slate-600">
                     <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                     Overtime (Holiday)
                   </span>
                                    <span className="font-mono font-medium">{calculation.overtimeHolidayPay.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                            </div>

                            <div className="h-px bg-slate-200 my-4" />

                            {/* Totals Section */}
                            <div className="space-y-4">
                                <div className="flex justify-between items-end bg-green-50 p-4 rounded-lg border border-green-100">
                                    <span className="text-lg font-bold text-green-900">Total On-Call Bonus</span>
                                    <span className="text-2xl font-bold text-green-700">{calculation.totalExtra.toLocaleString(undefined, {maximumFractionDigits: 0})} CZK</span>
                                </div>

                                <div className="space-y-1 pt-2">
                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                        <span>Monthly Base Salary</span>
                                        <span>{state.monthlySalary.toLocaleString()} CZK</span>
                                    </div>
                                    <div
                                        className="flex justify-between text-sm font-bold
             text-slate-900 dark:text-slate-50
             pt-2
             border-t border-slate-100 dark:border-slate-700"
                                    >
                                        <span>Gross Total (Salary + Bonus)</span>
                                        <span>{(state.monthlySalary + calculation.totalExtra).toLocaleString(undefined, {maximumFractionDigits: 0})} CZK</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Card Footer / Note (Moved here to prevent overlap) */}
                        <div className="bg-yellow-50 p-4 border-t border-yellow-100 text-xs text-yellow-800 flex gap-3">
                            <Info className="w-4 h-4 shrink-0 mt-0.5 text-yellow-600" />
                            <p className="leading-relaxed">
                                <strong>Calculation Note:</strong> Actual work hours are automatically subtracted from standby hours to prevent double billing. Holidays are detected automatically based on the Czech calendar.
                            </p>
                        </div>

                    </Card>
                </div>

            </div>
        </div>
        </div>
    );
}
