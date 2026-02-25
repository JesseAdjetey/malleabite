import { useParams } from 'react-router-dom';
import { BookingPageView } from '@/components/booking/BookingPageView';

export default function BookingPage() {
  const { bookingPageId } = useParams<{ bookingPageId: string }>();
  return <BookingPageView bookingPageId={bookingPageId || ''} />;
}
