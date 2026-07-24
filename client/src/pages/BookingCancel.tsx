import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, AlertCircle, Calendar, Clock, X } from "lucide-react";
import { toast } from "sonner";

export default function BookingCancel() {
  const { token } = useParams<{ token: string }>();
  const [, navigate] = useLocation();
  const [done, setDone] = useState(false);

  const { data, isLoading, error } = trpc.bookingManage.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const cancelMutation = trpc.bookingManage.cancel.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => toast.error(err.message),
  });

  if (!token) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#D4922A] animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link Not Found</h1>
          <p className="text-gray-500">This link is invalid, has already been used, or has expired.</p>
        </div>
      </div>
    );
  }

  if (done) {
    const rebookUrl = data.bookingUsername
      ? `${window.location.origin}/book/${data.bookingUsername}`
      : undefined;
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Booking Cancelled</h1>
          <p className="text-gray-600 mb-6">
            Your booking has been cancelled. You'll receive a confirmation email shortly.
          </p>
          {rebookUrl && (
            <Button
              onClick={() => navigate(rebookUrl)}
              className="bg-[#D4922A] hover:bg-[#D4911A] text-white"
            >
              Book a New Appointment
            </Button>
          )}
        </div>
      </div>
    );
  }

  const { booking, action, freelancerName, bookingUsername } = data;

  return (
    <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-md w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1C2333] to-[#2A2A2C] p-6 text-white">
          <h1 className="text-xl font-bold">
            {action === "cancel" ? "Cancel Booking" : "Reschedule Booking"}
          </h1>
          <p className="text-white/70 text-sm mt-1">with {freelancerName}</p>
        </div>

        <div className="p-6 space-y-5">
          {/* Booking details */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#D4922A]/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-[#D4922A]" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Service</p>
                <p className="font-semibold text-gray-900">{booking.service ?? "Session"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Date & Time</p>
                <p className="font-semibold text-gray-900">{booking.date} at {booking.time}</p>
              </div>
            </div>
          </div>

          {action === "cancel" ? (
            <>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <X className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800 text-sm">Confirm Cancellation</p>
                    <p className="text-red-600 text-sm mt-1">
                      This will permanently cancel your booking. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.history.back()}
                >
                  Keep Booking
                </Button>
                <Button
                  onClick={() =>
                    cancelMutation.mutate({ token, origin: window.location.origin })
                  }
                  disabled={cancelMutation.isPending}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                >
                  {cancelMutation.isPending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Cancelling…</>
                  ) : (
                    "Yes, Cancel"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-gray-600 text-sm">
                To reschedule, please cancel this booking and book a new time that works for you.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.history.back()}
                >
                  Go Back
                </Button>
                {bookingUsername && (
                  <Button
                    onClick={() => {
                      cancelMutation.mutate({ token, origin: window.location.origin });
                    }}
                    disabled={cancelMutation.isPending}
                    className="flex-1 bg-[#D4922A] hover:bg-[#D4911A] text-white"
                  >
                    {cancelMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</>
                    ) : (
                      "Cancel & Rebook"
                    )}
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
