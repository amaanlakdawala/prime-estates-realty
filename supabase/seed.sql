-- Optional: sample listings so the site isn't empty while you test.
-- Run in Supabase SQL Editor after schema.sql. Delete them later from /admin.
insert into public.listings (title, property_type, deal_type, price, area_sqft, bhk, floor, locality, address, latitude, longitude, description, amenities, rera_number, status, featured) values
('Spacious 2 BHK near Balewadi High Street', 'flat', 'buy', 8500000, 1050, 2, '7th of 14', 'Baner', 'Baner–Pashan Link Road, Baner, Pune 411045', 18.5590, 73.7868,
 'East-facing flat with two balconies and an open kitchen. Five minutes from Balewadi High Street and 20 minutes from Hinjewadi Phase 1.',
 array['Covered parking','Lift','Power backup','24x7 security','Gym','Swimming pool'], 'P52100012345', 'available', true),
('3 BHK with terrace garden in Wakad', 'flat', 'buy', 12500000, 1480, 3, '11th of 12', 'Wakad', 'Near Dange Chowk, Wakad, Pune 411057', 18.5987, 73.7626,
 'Top-floor home with a private terrace garden, two covered parking spots and views of the hills.',
 array['Covered parking','Lift','Clubhouse','Garden','Children''s play area','Piped gas'], 'P52100023456', 'available', true),
('Furnished 1 BHK for rent in Hinjewadi Phase 1', 'flat', 'rent', 22000, 620, 1, '4th of 10', 'Hinjewadi', 'Hinjewadi Phase 1, Pune 411057', 18.5913, 73.7389,
 'Walk to Infosys and Wipro campuses. Fully furnished with fridge, washing machine and beds.',
 array['Lift','Power backup','24x7 security','Fully furnished'], null, 'available', true),
('Office space for 25 people in Kharadi', 'office', 'rent', 145000, 2200, null, '5th of 9', 'Kharadi', 'EON IT Park Road, Kharadi, Pune 411014', 18.5519, 73.9476,
 'Ready-to-move office with 25 workstations, 2 cabins, a conference room and pantry. Lock-in of 3 years.',
 array['Covered parking','Lift','Power backup','CCTV'], null, 'available', false),
('4 BHK independent villa in Aundh', 'villa', 'buy', 42000000, 3600, 4, 'Ground + 2', 'Aundh', 'DP Road, Aundh, Pune 411007', 18.5642, 73.8078,
 'Corner villa on a 4,000 sq ft plot with a private garden, servant quarters and parking for three cars.',
 array['Covered parking','Garden','CCTV','Rainwater harvesting','Pet friendly'], null, 'available', false);
