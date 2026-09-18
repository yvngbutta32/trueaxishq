import { PublicShell } from "@/components/PublicShell";
import { useMemo, useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, Calendar, Clock, X } from "lucide-react";
import { toast } from "sonner";
import { PublicRecoveryState } from "@/components/PublicRecoveryState";

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM",
  "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
];

function getBookableDays(count = 14) {
  const days: Date[] = [];
  const today = new Date();
  for (let offset = 1; days.length < count; offset += 1) {
    const day = new Date(today);
    day.setDate(today.getDate() + offset);
    if (day.getDay() !== 0 && day.getDay() !== 6) days.push(day);
  }
  return days;
}

function toIsoDate(day: Date) {
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
}

export default function BookingCancel() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [done, setDone] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const availableDays = useMemo(() => getBookableDays(), []);

  const { data, isLoading, error } = trpc.bookingManage.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false },
  );
  const cancelMutation = trpc.bookingManage.cancel.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });
  const rescheduleMutation = trpc.bookingManage.reschedule.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });

  if (!token) return null;

  if (isLoading) {
    return <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center"><Loader2 className="w-8 h-8 text-[#D4922A] animate-spin" /></div>;
  }

  if (error || !data) {
    return <PublicRecoveryState eyebrow="TrueAxis HQ booking" title="This booking link is unavailable" description="It may be expired, already used, or copied incorrectly. Ask the service provider for a new secure link if you still need to make a change." privacyNote="For privacy, unavailable booking-management links cannot be restored from this page." />;
  }

  const { booking, action, freelancerName, bookingUsername, bookedSlots } = data;
  const isReschedule = action === "reschedule";

  if (done) {
    return (
      <PublicShell>
        <div className="p-8 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{isReschedule ? "Booking Rescheduled" : "Booking Cancelled"}</h1>
          <p className="text-gray-600 mb-6">
            {isReschedule ? "Your new appointment time is confirmed." : "Your booking has been cancelled."}
          </p>
          {!isReschedule && bookingUsername && (
            <Button onClick={() => navigate(`/book/${bookingUsername}`)} className="bg-[#D4922A] hover:bg-[#D4911A] text-white">
              Book a New Appointment
            </Button>
          )}
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="overflow-hidden text-left">
        <div className="bg-gradient-to-r from-[#1C2333] to-[#2A2A2C] p-6 text-white">
          <h1 className="text-xl font-bold">{isReschedule ? "Reschedule Booking" : "Cancel Booking"}</h1>
          <p className="text-white/70 text-sm mt-1">with {freelancerName}</p>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#D4922A]/10 flex items-center justify-center"><Calendar className="w-4 h-4 text-[#D4922A]" /></div>
              <div><p className="text-xs text-gray-500">Service</p><p className="font-semibold text-gray-900">{booking.service ?? "Session"}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Clock className="w-4 h-4 text-blue-500" /></div>
              <div><p className="text-xs text-gray-500">Current date & time</p><p className="font-semibold text-gray-900">{booking.date} at {booking.time}</p></div>
            </div>
          </div>

          {!isReschedule ? (
            <>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
                <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div><p className="font-semibold text-red-800 text-sm">Confirm Cancellation</p><p className="text-red-600 text-sm mt-1">This will permanently cancel your booking. This action cannot be undone.</p></div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>Keep Booking</Button>
                <Button onClick={() => cancelMutation.mutate({ token })} disabled={cancelMutation.isPending} className="flex-1 bg-red-500 hover:bg-red-600 text-white">
                  {cancelMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</> : "Yes, Cancel"}
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="font-semibold text-gray-900 text-sm">Choose a new date</p>
                <p className="text-gray-600 text-sm mt-1">Available weekdays for the next two weeks are shown below.</p>
                <div className="grid grid-cols-3 gap-2 mt-3" role="group" aria-label="Available reschedule dates">
                  {availableDays.map((day) => {
                    const iso = toIsoDate(day);
                    const selected = selectedDate === iso;
                    return <button key={iso} type="button" onClick={() => { setSelectedDate(iso); setSelectedTime(""); }} aria-pressed={selected} className={`min-h-[60px] rounded-xl border-2 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4922A] ${selected ? "border-[#D4922A] bg-[#D4922A]/10 text-[#8D5D00]" : "border-gray-200 hover:border-[#D4922A]/60 text-gray-800"}`}>
                      <span className="block text-xs text-gray-500">{day.toLocaleDateString("en-US", { weekday: "short" })}</span><span className="block font-bold">{day.getDate()}</span>
                    </button>;
                  })}
                </div>
              </div>
              {selectedDate && (
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Choose a new time</p>
                  <div className="grid grid-cols-3 gap-2 mt-3" role="group" aria-label="Available reschedule times">
                    {TIME_SLOTS.map((time) => {
                      const booked = bookedSlots.some((slot) => slot.date === selectedDate && slot.time === time);
                      const selected = selectedTime === time;
                      return <button key={time} type="button" disabled={booked} onClick={() => setSelectedTime(time)} aria-pressed={selected} className={`min-h-[44px] rounded-lg border text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D4922A] ${booked ? "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-400 line-through" : selected ? "border-[#D4922A] bg-[#D4922A]/10 text-[#8D5D00]" : "border-gray-200 hover:border-[#D4922A]/60 text-gray-800"}`}>
                        {booked ? "Taken" : time}
                      </button>;
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => window.history.back()}>Keep Current Time</Button>
                <Button onClick={() => rescheduleMutation.mutate({ token, date: selectedDate, time: selectedTime })} disabled={!selectedDate || !selectedTime || rescheduleMutation.isPending} className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white">
                  {rescheduleMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Rescheduling…</> : "Confirm New Time"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
