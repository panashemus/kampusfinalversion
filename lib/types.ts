export type View = 'auth' | 'radar' | 'hustle' | 'community' | 'escrow' | 'profile';

export type Comment = {
  id: string;
  authorId?: string;
  author: string;
  text: string;
  time: string;
};

export type Hazard = {
  id: string;
  position: [number, number];
  label: string;
  category: string;
  time: string;
  lockedToLive: boolean;
  upvotes: number;
  comments: Comment[];
};

export type CommunityCategory = 'All Questions' | 'Academic' | 'Housing' | 'Tech' | 'General' | 'Textbooks' | 'Beauty';

export type CommunityPost = {
  id: string;
  authorId: string;
  author: string;
  time: string;
  category: Exclude<CommunityCategory, 'All Questions'>;
  text: string;
  upvotes: number;
  comments: Comment[];
  images: string[];
};

export type HustleStatus = 'active' | 'unpaid_suspended';

export type Hustle = {
  id: string;
  sellerId: string;
  sellerName: string;
  title: string;
  price: number;
  category: string;
  description: string;
  referenceCode: string | null;
  paymentRefId: string | null;
  status: HustleStatus;
  images: string[];
  createdAt: string;
};

export type ReportReason = 'Spam' | 'Harassment' | 'Inappropriate Content' | 'Fake Alert';
export type ReportContentType = 'post' | 'hustle';
export type ReportStatus = 'pending' | 'dismissed' | 'deleted';

export type Report = {
  id: string;
  reporterId: string;
  contentType: ReportContentType;
  contentId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
};

export type Review = {
  id: string;
  author: string;
  rating: number;
  text: string;
  time: string;
};

export type UserProfile = {
  username: string;
  name: string;
  verified: boolean;
  rating: number;
  reviewCount: number;
  reviews: Review[];
  canReview: boolean;
};

export type SosAlert = {
  id: string;
  user_id: string | null;
  user_name: string | null;
  location_name: string | null;
  lat: number;
  lng: number;
  active: boolean;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  username: string | null;
  university: string | null;
  verified: boolean;
  email_verified: boolean;
  is_admin: boolean;
  is_premium: boolean;
  subscribed_until: string | null;
  sentinel_points: number;
  ewallet_number: string;
};

export type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  peer_username: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
};

export type HazardRow = {
  id: string;
  user_id: string;
  title: string;
  type: string;
  lat: number;
  lng: number;
  upvotes: number;
  created_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  type: 'message' | 'comment' | 'sos';
  title: string;
  body: string;
  reference_id: string | null;
  read: boolean;
  created_at: string;
};
