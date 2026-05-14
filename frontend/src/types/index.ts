export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin',
}

export interface User {
  id: string;
  email: string;
  username?: string;
  firstName: string;
  lastName: string;
  idType?: string;
  idNumber?: string;
  phone?: string;
  address?: string;
  avatarUrl?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// Dynamic categories are now loaded from the backend


export enum EventStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export interface Event {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  imageUrl?: string;
  bannerImageUrl?: string;
  bannerPosition?: string;
  venueName: string;
  venueAddress?: string;
  eventDate: string;
  doorsOpen?: string;
  status: EventStatus;
  isFeatured: boolean;
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  organizerId: string;
  organizer?: User;
  sections?: VenueSection[];
  defaultViewX?: number;
  defaultViewY?: number;
  defaultViewZoom?: number;
  showStage?: boolean;
  createdAt: string;
  updatedAt?: string;
  pendingTitle?: string;
  pendingDescription?: string;
  pendingImageUrl?: string;
  pendingBannerImageUrl?: string;
  pendingVenueName?: string;
  pendingCategory?: string;
  pendingEventDate?: string;
}

export enum SectionType {
  SEATED = 'seated',
  STANDING = 'standing',
  TABLE = 'table',
  VIP = 'vip',
  STAGE = 'stage',
  DECOR = 'decor',
}

export interface VenueSection {
  id: string;
  eventId: string;
  name: string;
  sectionType: SectionType;
  rows: number;
  seatsPerRow: number;
  capacity: number;
  price: number;
  color: string;
  sortOrder: number;
  mapX: number;
  mapY: number;
  mapWidth: number;
  mapHeight: number;
  curve?: number;
  isWheelchair?: boolean;
  tableShape?: 'round' | 'rectangular';
  tablePurchaseMode?: 'individual' | 'whole';
  seatsConfig?: string;
  seats?: Seat[];
}

export enum SeatStatus {
  AVAILABLE = 'available',
  LOCKED = 'locked',
  SOLD = 'sold',
}

export interface Seat {
  id: string;
  sectionId: string;
  rowLabel: string;
  seatNumber: number;
  status: SeatStatus;
  lockedBy?: string;
  lockExpiresAt?: string;
}

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export interface Order {
  id: string;
  userId: string;
  eventId: string;
  event?: Event;
  subtotal: number;
  serviceFee: number;
  total: number;
  status: OrderStatus;
  ticketCount: number;
  createdAt: string;
}

export enum TicketStatus {
  ACTIVE = 'active',
  USED = 'used',
  CANCELLED = 'cancelled',
}

export interface Ticket {
  id: string;
  ticketCode: string;
  orderId: string;
  eventId: string;
  event?: Event;
  userId: string;
  user?: User;
  seatId?: string;
  sectionName?: string;
  rowLabel?: string;
  seatNumber?: number;
  qrData?: string;
  price: number;
  status: TicketStatus;
  createdAt: string;
}

export interface EventsResponse {
  events: Event[];
  total: number;
  page: number;
  totalPages: number;
}

export interface SalesReport {
  orders: Order[];
  totalRevenue: number;
  totalTickets: number;
  totalOrders: number;
}

// CATEGORY_INFO is removed as it's now dynamically fetched from CategoryContext
