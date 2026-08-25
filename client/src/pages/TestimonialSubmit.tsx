import { useState } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function TestimonialSubmit() {
  const { token } = useParams<{ token: string }>();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = trpc.testimonials.getByToken.useQuery(
    { token: token ?? "" },
    { enabled: !!token, retry: false }
  );

  const submitMutation = trpc.testimonials.submit.useMutation({
    onSuccess: () => setSubmitted(true),
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
          <p className="text-gray-500">This testimonial link is invalid or has expired.</p>
          <a href="/" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg border border-[#D4922A]/35 px-4 text-sm font-semibold text-[#8a5a0b] transition-colors hover:bg-[#fffaf0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4922A]">Return to TrueAxis HQ</a>
        </div>
      </div>
    );
  }

  if (data.status !== "requested" || submitted) {
    return (
      <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-gray-600">Your testimonial has been submitted and is pending review.</p>
          <p className="text-sm text-gray-400 mt-4">You may close this window.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F0EC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-lg w-full">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#D4922A] to-[#D4911A] p-6 text-white">
          <h1 className="text-xl font-bold">How was your experience?</h1>
          <p className="text-white/80 text-sm mt-1">
            Hi {data.clientName} — {data.freelancerName} would love your feedback.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Star Rating */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-3">Your Rating *</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHovered(star)}
                  onMouseLeave={() => setHovered(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                  aria-label={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      star <= (hovered || rating)
                        ? "fill-[#D4922A] text-[#D4922A]"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {["", "Poor", "Fair", "Good", "Great", "Excellent!"][rating]}
              </p>
            )}
          </div>

          {/* Written Review */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Your Testimonial *
            </label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share your experience working together..."
              rows={5}
              className="resize-none"
              maxLength={2000}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{body.length}/2000</p>
          </div>

          <Button
            onClick={() => submitMutation.mutate({ token, body, rating })}
            disabled={rating === 0 || body.trim().length < 10 || submitMutation.isPending}
            className="w-full bg-[#D4922A] hover:bg-[#D4911A] text-white font-semibold py-3"
          >
            {submitMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
            ) : (
              "Submit Testimonial"
            )}
          </Button>

          <p className="text-xs text-gray-400 text-center">
            Your testimonial may be featured on the public booking page after review.
          </p>
        </div>
      </div>
    </div>
  );
}
