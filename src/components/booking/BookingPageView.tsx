// Booking Page Component - Public scheduling page for appointment booking
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Clock, 
  Calendar as CalendarIcon, 
  MapPin, 
  Video, 
  User, 
  Mail, 
  MessageSquare,
  Check,
  ChevronLeft,
  ChevronRight,
  Globe,
  Loader2,
} from 'lucide-react';
import { 
  useAppointmentScheduling, 
  BookingPage, 
  AvailabilityWindow 
} from '@/hooks/use-appointment-scheduling';
import dayjs, { Dayjs } from 'dayjs';
import { cn } from '@/lib/utils';

interface BookingPageViewProps {
  bookingPageId: string;
  bookingPage?: BookingPage;
}

export function BookingPageView({ bookingPageId, bookingPage: initialPage }: BookingPageViewProps) {
  const { bookingPages, getAvailableSlots, createBooking, loading } = useAppointmentScheduling();
  
  // Find booking page from loaded pages or use initial
  const bookingPage = useMemo(() => {
    return initialPage || bookingPages.find(p => p.id === bookingPageId || p.slug === bookingPageId);
  }, [initialPage, bookingPages, bookingPageId]);

  const [step, setStep] = useState<'date' | 'time' | 'form' | 'confirm'>('date');
  const [selectedDate, setSelectedDate] = useState<Dayjs | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    notes: '',
    customFields: {} as Record<string, string>,
  });

  // Fetch available slots when date changes
  useEffect(() => {
    if (selectedDate && bookingPage) {
      setLoadingSlots(true);
      getAvailableSlots(bookingPage.id, selectedDate.toDate())
        .then(slots => {
          setAvailableSlots(slots);
          setLoadingSlots(false);
        });
    }
  }, [selectedDate, bookingPage, getAvailableSlots]);

  // Check if a date has availability
  const isDateAvailable = (date: Date): boolean => {
    if (!bookingPage) return false;
    
    const day = dayjs(date);
    const dayOfWeek = day.day();
    
    // Check if day is within booking window
    const now = dayjs();
    const minDate = now.add(bookingPage.minNotice || 0, 'hour');
    const maxDate = now.add(bookingPage.maxAdvance || 30, 'day');
    
    if (day.isBefore(minDate, 'day') || day.isAfter(maxDate, 'day')) {
      return false;
    }
    
    // Check if day has availability windows
    return bookingPage.availability.some(w => w.dayOfWeek === dayOfWeek && w.enabled);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(dayjs(date));
      setSelectedTime(null);
      setStep('time');
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingPage || !selectedTime || !selectedDate || !formData.name || !formData.email) return;
    
    setSubmitting(true);
    try {
      const startDateTime = selectedDate.format('YYYY-MM-DD') + ' ' + selectedTime;
      
      await createBooking(bookingPage.id, {
        guestName: formData.name,
        guestEmail: formData.email,
        guestPhone: formData.phone || undefined,
        startsAt: dayjs(startDateTime).toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        customFieldResponses: formData.customFields,
      });
      setConfirmed(true);
      setStep('confirm');
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    if (step === 'time') setStep('date');
    else if (step === 'form') setStep('time');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bookingPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold mb-2">Booking page not found</h2>
            <p className="text-muted-foreground">
              This booking link may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Confirmation step
  if (confirmed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-muted/30">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Booking Confirmed!</h2>
            <p className="text-muted-foreground mb-4">
              Your meeting has been scheduled. A confirmation email has been sent to {formData.email}.
            </p>
            <div className="bg-muted p-4 rounded-lg text-left space-y-2">
              <div className="font-medium">{bookingPage.title}</div>
              <div className="flex items-center gap-2 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {dayjs(selectedTime).format('dddd, MMMM D, YYYY')}
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4" />
                {dayjs(selectedTime).format('h:mm A')} - {dayjs(selectedTime).add(bookingPage.duration, 'minute').format('h:mm A')}
              </div>
              {bookingPage.location && (
                <div className="flex items-center gap-2 text-sm">
                  {bookingPage.locationType === 'video' ? (
                    <Video className="h-4 w-4" />
                  ) : (
                    <MapPin className="h-4 w-4" />
                  )}
                  {bookingPage.location}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="overflow-hidden">
          <div className="md:flex">
            {/* Left Panel - Booking Info */}
            <div className="md:w-1/3 bg-muted/50 p-6 border-r">
              <div className="flex items-center gap-3 mb-6">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>{bookingPage.title?.charAt(0) || 'M'}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm text-muted-foreground">Meeting with</div>
                  <div className="font-medium">Malleabite</div>
                </div>
              </div>

              <h1 className="text-2xl font-bold mb-2">{bookingPage.title}</h1>
              
              {bookingPage.description && (
                <p className="text-muted-foreground mb-4">{bookingPage.description}</p>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {bookingPage.duration} minutes
                </div>
                
                {bookingPage.location && (
                  <div className="flex items-center gap-2 text-sm">
                    {bookingPage.locationType === 'video' ? (
                      <Video className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                    {bookingPage.location}
                  </div>
                )}

                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>

              {/* Selected date/time preview */}
              {selectedDate && (
                <div className="mt-6 pt-6 border-t">
                  <div className="text-sm font-medium mb-2">Selected</div>
                  <div className="bg-primary/10 rounded-lg p-3">
                    <div className="font-medium">
                      {selectedDate.format('dddd, MMMM D, YYYY')}
                    </div>
                    {selectedTime && (
                      <div className="text-sm text-muted-foreground">
                        {dayjs(selectedTime).format('h:mm A')} - {dayjs(selectedTime).add(bookingPage.duration, 'minute').format('h:mm A')}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Panel - Selection/Form */}
            <div className="md:w-2/3 p-6">
              {/* Navigation */}
              {step !== 'date' && (
                <Button variant="ghost" size="sm" onClick={goBack} className="mb-4">
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}

              {/* Date Selection */}
              {step === 'date' && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">Select a Date</h2>
                  <Calendar
                    mode="single"
                    selected={selectedDate?.toDate()}
                    onSelect={handleDateSelect}
                    disabled={(date) => !isDateAvailable(date)}
                    className="rounded-md border"
                  />
                </div>
              )}

              {/* Time Selection */}
              {step === 'time' && (
                <div>
                  <h2 className="text-lg font-semibold mb-4">
                    Select a Time
                    <span className="font-normal text-muted-foreground ml-2">
                      {selectedDate?.format('MMMM D')}
                    </span>
                  </h2>
                  
                  {loadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : availableSlots.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No available times on this date
                    </div>
                  ) : (
                    <ScrollArea className="h-80">
                      <div className="grid grid-cols-3 gap-2">
                        {availableSlots.map((slot) => (
                          <Button
                            key={slot}
                            variant={selectedTime === slot ? 'default' : 'outline'}
                            onClick={() => handleTimeSelect(slot)}
                            className="justify-center"
                          >
                            {dayjs(slot).format('h:mm A')}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              )}

              {/* Form */}
              {step === 'form' && (
                <form onSubmit={handleSubmit}>
                  <h2 className="text-lg font-semibold mb-4">Enter Details</h2>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        required
                      />
                    </div>

                    {/* Custom fields */}
                    {bookingPage.customFields?.map((field) => (
                      <div key={field.id} className="space-y-2">
                        <Label htmlFor={field.id}>
                          {field.label}
                          {field.required && ' *'}
                        </Label>
                        {field.type === 'textarea' ? (
                          <Textarea
                            id={field.id}
                            value={formData.customFields[field.id] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [field.id]: e.target.value }
                            })}
                            required={field.required}
                          />
                        ) : (
                          <Input
                            id={field.id}
                            type={field.type}
                            value={formData.customFields[field.id] || ''}
                            onChange={(e) => setFormData({
                              ...formData,
                              customFields: { ...formData.customFields, [field.id]: e.target.value }
                            })}
                            required={field.required}
                          />
                        )}
                      </div>
                    ))}

                    <div className="space-y-2">
                      <Label htmlFor="notes">Additional notes</Label>
                      <Textarea
                        id="notes"
                        placeholder="Share anything that will help prepare for our meeting..."
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Scheduling...
                        </>
                      ) : (
                        'Schedule Meeting'
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </Card>

        <div className="text-center mt-4 text-sm text-muted-foreground">
          Powered by Malleabite
        </div>
      </div>
    </div>
  );
}

export default BookingPageView;
