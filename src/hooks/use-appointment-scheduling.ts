// Appointment Scheduling / Booking Pages Hook
// Allows users to create public booking pages for others to schedule time
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// Booking page configuration
export interface BookingPage {
  id: string;
  userId: string;
  slug: string; // URL-friendly identifier (e.g., "john-30min")
  title: string;
  description?: string;
  duration: number; // minutes
  location?: string;
  locationType: 'in_person' | 'video' | 'phone' | 'custom';
  videoProvider?: 'zoom' | 'google_meet' | 'teams' | 'jitsi';
  
  // Availability settings
  availability: AvailabilityWindow[];
  bufferBefore: number; // minutes before
  bufferAfter: number; // minutes after
  minNotice: number; // hours in advance required
  maxAdvance: number; // days in advance allowed
  
  // Limits
  maxBookingsPerDay?: number;
  maxBookingsPerWeek?: number;
  
  // Custom fields
  customFields: BookingFormField[];
  
  // Appearance
  color: string;
  brandingEnabled: boolean;
  confirmationMessage?: string;
  
  // Status
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityWindow {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  enabled: boolean;
  slots: { start: string; end: string }[]; // HH:mm format
}

export interface BookingFormField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  options?: string[]; // for select type
  placeholder?: string;
}

// A single booking/appointment
export interface Booking {
  id: string;
  bookingPageId: string;
  userId: string; // page owner
  
  // Guest info
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  customFieldResponses: Record<string, string>;
  
  // Timing
  startsAt: string;
  endsAt: string;
  timeZone: string;
  
  // Status
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
  cancelledBy?: 'host' | 'guest';
  cancelReason?: string;
  
  // Meeting details
  meetingUrl?: string;
  location?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
}

// Default availability (9 AM - 5 PM, Monday-Friday)
export const DEFAULT_AVAILABILITY: AvailabilityWindow[] = [
  { dayOfWeek: 0, enabled: false, slots: [] }, // Sunday
  { dayOfWeek: 1, enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 2, enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 3, enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 4, enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 5, enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
  { dayOfWeek: 6, enabled: false, slots: [] }, // Saturday
];

export interface BookingPageFormData {
  title: string;
  description?: string;
  duration: number;
  location?: string;
  locationType: 'in_person' | 'video' | 'phone' | 'custom';
  videoProvider?: 'zoom' | 'google_meet' | 'teams' | 'jitsi';
  availability?: AvailabilityWindow[];
  bufferBefore?: number;
  bufferAfter?: number;
  minNotice?: number;
  maxAdvance?: number;
  color?: string;
}

export function useAppointmentScheduling() {
  const { user } = useAuth();
  const [bookingPages, setBookingPages] = useState<BookingPage[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's booking pages
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchBookingPages = async () => {
      try {
        const pagesRef = collection(db, 'booking_pages');
        const q = query(
          pagesRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        
        const pages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as BookingPage[];
        
        setBookingPages(pages);
      } catch (error) {
        console.error('Failed to fetch booking pages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookingPages();
  }, [user?.uid]);

  // Create a new booking page
  const createBookingPage = useCallback(async (data: BookingPageFormData) => {
    if (!user?.uid) return { success: false, error: 'Not authenticated' };

    try {
      // Generate slug from title
      const baseSlug = data.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const slug = `${baseSlug}-${data.duration}min`;

      const pageData: Omit<BookingPage, 'id'> = {
        userId: user.uid,
        slug,
        title: data.title,
        description: data.description,
        duration: data.duration,
        location: data.location,
        locationType: data.locationType,
        videoProvider: data.videoProvider,
        availability: data.availability || DEFAULT_AVAILABILITY,
        bufferBefore: data.bufferBefore || 0,
        bufferAfter: data.bufferAfter || 0,
        minNotice: data.minNotice || 24, // 24 hours default
        maxAdvance: data.maxAdvance || 60, // 60 days default
        customFields: [
          { id: 'name', label: 'Name', type: 'text', required: true },
          { id: 'email', label: 'Email', type: 'email', required: true },
        ],
        color: data.color || '#3b82f6',
        brandingEnabled: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'booking_pages'), pageData);
      const newPage = { id: docRef.id, ...pageData };
      
      setBookingPages(prev => [newPage, ...prev]);
      toast.success('Booking page created!');
      
      return { success: true, page: newPage };
    } catch (error) {
      console.error('Failed to create booking page:', error);
      toast.error('Failed to create booking page');
      return { success: false, error };
    }
  }, [user?.uid]);

  // Update booking page
  const updateBookingPage = useCallback(async (
    pageId: string,
    updates: Partial<BookingPageFormData>
  ) => {
    if (!user?.uid) return { success: false };

    try {
      const docRef = doc(db, 'booking_pages', pageId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      setBookingPages(prev =>
        prev.map(page =>
          page.id === pageId
            ? { ...page, ...updates, updatedAt: new Date().toISOString() }
            : page
        )
      );

      toast.success('Booking page updated');
      return { success: true };
    } catch (error) {
      console.error('Failed to update booking page:', error);
      toast.error('Failed to update');
      return { success: false, error };
    }
  }, [user?.uid]);

  // Delete booking page
  const deleteBookingPage = useCallback(async (pageId: string) => {
    if (!user?.uid) return { success: false };

    try {
      await deleteDoc(doc(db, 'booking_pages', pageId));
      setBookingPages(prev => prev.filter(p => p.id !== pageId));
      toast.success('Booking page deleted');
      return { success: true };
    } catch (error) {
      console.error('Failed to delete booking page:', error);
      toast.error('Failed to delete');
      return { success: false, error };
    }
  }, [user?.uid]);

  // Toggle booking page active status
  const togglePageActive = useCallback(async (pageId: string) => {
    const page = bookingPages.find(p => p.id === pageId);
    if (!page) return;

    return updateBookingPage(pageId, { 
      // @ts-ignore - we need isActive but it's not in BookingPageFormData
      isActive: !page.isActive 
    } as any);
  }, [bookingPages, updateBookingPage]);

  // Get available time slots for a booking page on a specific date
  const getAvailableSlots = useCallback(async (
    pageId: string,
    date: Date
  ): Promise<string[]> => {
    const page = bookingPages.find(p => p.id === pageId);
    if (!page || !page.isActive) return [];

    const dayOfWeek = date.getDay();
    const dayAvailability = page.availability.find(a => a.dayOfWeek === dayOfWeek);
    
    if (!dayAvailability?.enabled) return [];

    // Get existing bookings for this date
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    const bookingsRef = collection(db, 'bookings');
    const q = query(
      bookingsRef,
      where('bookingPageId', '==', pageId),
      where('status', 'in', ['pending', 'confirmed'])
    );
    
    const snapshot = await getDocs(q);
    const existingBookings = snapshot.docs
      .map(doc => doc.data() as Booking)
      .filter(b => dayjs(b.startsAt).format('YYYY-MM-DD') === dateStr);

    // Generate all possible slots
    const slots: string[] = [];
    const bufferTotal = page.bufferBefore + page.bufferAfter;

    for (const window of dayAvailability.slots) {
      let currentTime = dayjs(`${dateStr} ${window.start}`);
      const endTime = dayjs(`${dateStr} ${window.end}`);

      while (currentTime.add(page.duration, 'minute').isBefore(endTime) || 
             currentTime.add(page.duration, 'minute').isSame(endTime)) {
        const slotStart = currentTime.format('HH:mm');
        const slotEnd = currentTime.add(page.duration, 'minute').format('HH:mm');

        // Check if slot conflicts with existing bookings
        const hasConflict = existingBookings.some(booking => {
          const bookingStart = dayjs(booking.startsAt);
          const bookingEnd = dayjs(booking.endsAt);
          const slotStartTime = dayjs(`${dateStr} ${slotStart}`);
          const slotEndTime = dayjs(`${dateStr} ${slotEnd}`);

          return (
            (slotStartTime.isAfter(bookingStart) && slotStartTime.isBefore(bookingEnd)) ||
            (slotEndTime.isAfter(bookingStart) && slotEndTime.isBefore(bookingEnd)) ||
            (slotStartTime.isSame(bookingStart) || slotEndTime.isSame(bookingEnd))
          );
        });

        // Check min notice
        const slotDateTime = dayjs(`${dateStr} ${slotStart}`);
        const minNoticeTime = dayjs().add(page.minNotice, 'hour');
        const withinNotice = slotDateTime.isAfter(minNoticeTime);

        if (!hasConflict && withinNotice) {
          slots.push(slotStart);
        }

        currentTime = currentTime.add(page.duration + bufferTotal, 'minute');
      }
    }

    return slots;
  }, [bookingPages]);

  // Create a booking (called by guest)
  const createBooking = useCallback(async (
    pageId: string,
    data: {
      guestName: string;
      guestEmail: string;
      guestPhone?: string;
      startsAt: string;
      timeZone: string;
      customFieldResponses?: Record<string, string>;
    }
  ) => {
    try {
      const page = bookingPages.find(p => p.id === pageId);
      if (!page) throw new Error('Booking page not found');

      const startsAt = dayjs(data.startsAt);
      const endsAt = startsAt.add(page.duration, 'minute');

      const booking: Omit<Booking, 'id'> = {
        bookingPageId: pageId,
        userId: page.userId,
        guestName: data.guestName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        customFieldResponses: data.customFieldResponses || {},
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        timeZone: data.timeZone,
        status: 'confirmed', // Auto-confirm for now
        location: page.location,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        confirmedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'bookings'), booking);
      
      // TODO: Send confirmation emails
      // TODO: Create calendar event for host
      
      toast.success('Appointment booked!');
      return { success: true, booking: { id: docRef.id, ...booking } };
    } catch (error) {
      console.error('Failed to create booking:', error);
      toast.error('Failed to book appointment');
      return { success: false, error };
    }
  }, [bookingPages]);

  // Cancel a booking
  const cancelBooking = useCallback(async (
    bookingId: string,
    cancelledBy: 'host' | 'guest',
    reason?: string
  ) => {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      await updateDoc(docRef, {
        status: 'cancelled',
        cancelledBy,
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setBookings(prev =>
        prev.map(b =>
          b.id === bookingId
            ? { ...b, status: 'cancelled', cancelledBy, cancelReason: reason }
            : b
        )
      );

      toast.success('Booking cancelled');
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error('Failed to cancel booking');
      return { success: false, error };
    }
  }, []);

  // Get booking page public URL
  const getBookingUrl = useCallback((page: BookingPage) => {
    return `${window.location.origin}/book/${page.slug}`;
  }, []);

  // Copy booking URL to clipboard
  const copyBookingUrl = useCallback((page: BookingPage) => {
    const url = getBookingUrl(page);
    navigator.clipboard.writeText(url);
    toast.success('Booking link copied!');
  }, [getBookingUrl]);

  return {
    bookingPages,
    bookings,
    loading,
    createBookingPage,
    updateBookingPage,
    deleteBookingPage,
    togglePageActive,
    getAvailableSlots,
    createBooking,
    cancelBooking,
    getBookingUrl,
    copyBookingUrl,
  };
}

export default useAppointmentScheduling;
