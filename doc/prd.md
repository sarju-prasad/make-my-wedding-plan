# Make My Wedding Plan
## V1 Product Requirements Document (PRD)

**Document Status:** V1 Product Definition  
**Product Type:** Private collaborative wedding-management platform  
**Target Market:** Indian weddings  
**Primary Experience:** Responsive web application

---

# 1. Product Vision

**Make My Wedding Plan** is a private, collaborative wedding-management platform designed for Indian weddings.

It allows the bride, groom, and their family to manage wedding planning and the guest experience from one place.

The platform combines:

- Wedding and event planning
- Family collaboration
- Guest management
- RSVP
- Task management
- Vendor management
- Expense tracking
- Private wedding website
- Announcements
- External livestreaming
- Wedding photo collection and sharing

The product follows a simple principle:

> **Plan the wedding together, invite guests privately, experience the wedding, and preserve the memories.**

---

# 2. Problem Statement

Planning an Indian wedding usually involves multiple people, events, vendors, guest lists, WhatsApp conversations, spreadsheets, documents, photo-sharing applications, and separate livestream links.

This creates problems such as:

- Wedding information is scattered across different platforms.
- Family members do not have a single shared planning workspace.
- Guest lists become difficult to maintain.
- RSVP information is difficult to track.
- Tasks are forgotten or unclear about who owns them.
- Vendor information is scattered.
- Wedding expenses are difficult to track.
- Guests need a simple way to access wedding information.
- Wedding photos are distributed across many people's phones.
- Private wedding information should not be publicly searchable.

Make My Wedding Plan brings these activities into one private wedding workspace.

---

# 3. Product Goals

## Primary Goals

1. Allow families to collaboratively manage a wedding.
2. Support multiple wedding events.
3. Make guest invitation and RSVP management simple.
4. Provide a private guest-facing wedding website.
5. Allow guests to upload and share wedding photos without creating accounts.
6. Provide simple task and vendor management.
7. Provide basic expense tracking.
8. Allow event-specific livestream access.
9. Preserve wedding memories after the wedding.
10. Keep the V1 experience simple enough for non-technical users.

## Non-Goals for V1

V1 should not attempt to become:

- A full wedding marketplace
- A full website builder
- A social network
- A video streaming infrastructure
- A travel/accommodation management platform
- A wedding finance/accounting system
- A native mobile application

---

# 4. User Types

There are three fundamental user types.

## 4.1 Admin

An Admin has an account and manages the wedding.

The Admin has access to critical wedding-management operations.

## 4.2 Manager

A Manager has an account and handles day-to-day wedding management.

Multiple Managers can collaborate on the same wedding.

## 4.3 Guest

A Guest:

- Has no account
- Has no password
- Has no application role
- Does not log in

Guests access the wedding through a **unique invitation link or QR code**.

The invitation acts as their access credential.

---

# 5. Access Model

```text
Wedding
│
├── Admin
│   └── Account
│
├── Managers
│   └── Accounts
│
└── Guests
    └── Invitation
        └── Unique Access Link / QR
```

Guests are intentionally not treated as normal application users.

---

# 6. Wedding Lifecycle

The basic lifecycle is:

```text
Create Wedding
      ↓
Configure Wedding
      ↓
Invite Family Members
      ↓
Create Events
      ↓
Manage Guests
      ↓
Plan Tasks / Vendors / Expenses
      ↓
Publish Wedding Website
      ↓
Wedding Day
      ↓
Photos / Livestream / Announcements
      ↓
Archive Mode
```

After the wedding, the wedding enters **Archive Mode**.

Archived wedding information is retained indefinitely in V1.

---

# 7. Wedding Management

A wedding is the primary container for all wedding-related information.

## Wedding information

The wedding should contain:

- Couple names
- Main couple photo
- Overall wedding date
- Overall wedding location
- Wedding website
- Family members
- Guest groups
- Events
- Tasks
- Vendors
- Expenses
- Photos
- Announcements
- Livestream information

## Overall wedding date

The overall wedding date is required.

It is used for:

- Wedding countdown
- Wedding lifecycle
- Archive transition

---

# 8. Family Collaboration

The wedding creator becomes the initial Admin.

The Admin can invite Managers through email.

Managers receive an invitation and create/join their account using passwordless email authentication.

## Authentication

V1 uses passwordless email authentication for wedding members.

No traditional password-management workflow is required.

Authentication links should be:

- Secure
- Single-use where appropriate
- Time-limited
- Invalidated after successful use

---

# 9. Admin Permissions

Admin can perform all normal wedding-management operations.

Admin can:

- Manage wedding information
- Create/edit/manage events
- Manage family members
- Manage guests
- Manage RSVP
- Manage tasks
- Manage vendors
- Manage expenses
- Manage website
- Manage photos
- Manage announcements
- Manage livestreams
- Archive the wedding
- Perform critical wedding/account operations

Admin is the protected administrative role.

---

# 10. Manager Permissions

Managers can perform day-to-day wedding operations.

Managers can:

- Create events
- Edit events
- Manage event information
- Manage event guests
- Manage RSVP
- Create and assign tasks
- Manage tasks
- Manage vendors
- Manage expenses
- Edit website content
- Publish/unpublish website
- Upload photos
- Create announcements
- Manage livestream links

Managers cannot perform protected Admin-only operations.

---

# 11. Event Management

A wedding can contain multiple independent events.

Examples:

- Engagement
- Haldi
- Mehendi
- Sangeet
- Wedding Ceremony
- Reception

Each event can have:

- Event name
- Date
- Optional time
- Optional description
- Optional cover image
- Venue/location
- Google Maps link
- Invited guests
- Tasks
- Vendors
- Photos
- Announcements
- Livestream

## Event date

Event date is required.

## Event time

Event time is optional.

This allows families to create an event before finalizing the exact timing.

## Event deletion

Events are **never permanently deleted** in V1.

If the Admin removes an event, it becomes inactive/archived rather than permanently destroying its information.

Associated information should be preserved.

---

# 12. Guest Management

Guest management uses a hybrid model:

```text
Guest Group
   │
   ├── Individual Guest
   ├── Individual Guest
   ├── Individual Guest
   └── Individual Guest
```

Example:

**Sharma Family**

- Rahul
- Neha
- Amit
- Priya

## Guest information

V1 collects:

- Guest name
- Email — optional

Phone number is not required for V1.

## Guest management capabilities

Family members can:

- Create guest groups
- Add individual guests
- Edit guest information
- Select invited events
- Generate invitation links
- Generate QR codes
- Track RSVP

Advanced guest profile information is excluded from V1.

---

# 13. Guest Invitations

Each guest/group receives a unique invitation URL.

Example:

```text
yourapp.com/i/AB12XY
```

The same URL is represented as a QR code.

Guests can receive the invitation through:

- WhatsApp
- Email
- Printed invitation QR code

## Guest authentication

Guests do not:

- Register
- Login
- Create passwords
- Create accounts
- Receive application roles

The invitation link provides access.

## Forwarded invitations

If an invitation link is forwarded, it may initially work.

Family members can revoke the invitation if misuse is discovered.

## Invitation expiry

Guest invitation links automatically expire after the wedding.

They can also be manually revoked before expiry.

---

# 14. Guest Privacy

The wedding website is private.

If someone directly visits:

```text
yourapp.com/w/couple-name
```

without valid invitation access, they see a private-wedding message.

Example:

> This wedding is private. Please use your invitation link to access it.

Wedding information is not publicly exposed.

---

# 15. Event-Level Guest Access

Guests see only the events they are invited to.

Example:

```text
Guest A
 ├── Haldi
 └── Wedding Ceremony

Guest B
 └── Reception
```

Guest A cannot view Guest B's uninvited event information.

This applies to:

- Event information
- Event-specific livestream
- Event-specific guest experience

---

# 16. RSVP

V1 supports event-level RSVP.

Each invited guest can respond:

- Yes
- No

For guest groups, both group-level and individual-level tracking are supported.

Example:

**Sharma Family**

```text
Group response: Yes
Members: 4
Attending: 3 / 4

Rahul   → Yes
Neha    → Yes
Amit    → No
Priya   → Yes
```

## RSVP reminders

Guests who have not responded receive **one RSVP reminder**.

No repeated reminders are sent.

---

# 17. Guest Event Reminders

Guests receive an email reminder **24 hours before an event** they are invited to, when an email address is available.

Example:

> Tomorrow: Wedding Ceremony  
> 20 November, 7:00 PM  
> ABC Wedding Venue

---

# 18. Event Change Notifications

Guests are notified by email when a critical event detail changes.

Critical changes are:

- Date
- Time
- Venue

Changes to descriptions or other non-critical information do not trigger guest emails.

Only guests invited to the affected event receive the notification.

---

# 19. Wedding Website

Each wedding receives two URL types.

## Wedding website

```text
yourapp.com/w/couple-name
```

## Invitation URL

```text
yourapp.com/i/AB12XY
```

The readable website URL does not provide guest access by itself.

---

# 20. Website Templates

V1 provides multiple predefined website templates.

Family workflow:

```text
Choose Template
      ↓
Enter Content
      ↓
Save Draft
      ↓
Preview
      ↓
Publish
```

V1 is not a full website builder.

---

# 21. Website Customization

Family members can customize content such as:

- Couple names
- Couple photo
- Wedding date
- Couple's story
- Event details
- Venue
- Important information
- Announcements

Visual design remains controlled by the selected template.

V1 does not provide:

- Drag and drop
- Custom CSS
- Custom fonts
- Custom color systems
- Advanced layouts

---

# 22. Website Sections

V1 website includes:

1. Couple / Hero
2. Wedding Countdown
3. Couple's Story
4. Events
5. Venue / Map
6. RSVP
7. Photo Gallery
8. Announcements
9. Live Stream
10. Important Information

V1 does not include:

- Accommodation
- Transportation
- Wishes/guest messages

---

# 23. Website Language

V1 supports:

- English
- Hindi

The family selects **one language** for the wedding website.

All guests see the selected language.

Guest-side language switching is not included in V1.

---

# 24. Website Preview & Publishing

Website states:

- Draft
- Published
- Unpublished

Family members can:

- Edit
- Save draft
- Preview
- Publish
- Unpublish
- Publish again

Managers can publish/unpublish.

Admin does not have special publishing authority.

---

# 25. Venue & Maps

The wedding supports an overall location.

Each event can have its own venue.

Example:

```text
Wedding Location: Ahmedabad

Haldi:
Home

Sangeet:
ABC Banquet Hall

Wedding:
XYZ Resort
```

Family members can paste a Google Maps link.

Guests see:

> Get Directions

No custom mapping system is required for V1.

---

# 26. Tasks

V1 provides shared assigned tasks.

Each task contains:

- Task name
- Optional description
- Assigned family member
- Due date
- Status
- Created by
- Created date

Statuses:

- To Do
- In Progress
- Done

## Task scope

Tasks can belong to:

- Wedding
- Event

Example:

```text
Wedding
 └── Finalize guest list

Wedding
 └── Sangeet
      └── Confirm stage decoration
```

---

# 27. Vendor Management

V1 provides simple vendor management.

Vendor information:

- Vendor name
- Category
- Contact number
- Notes
- Optional event
- Status

Vendor statuses:

- Shortlisted
- Confirmed
- Completed

Example categories:

- Photographer
- Caterer
- Decorator
- Makeup artist
- DJ
- Venue
- Priest
- Invitation provider
- Other

Advanced vendor features are excluded.

---

# 28. Vendor ↔ Task Relationship

A task can optionally be linked to a vendor.

Example:

```text
Vendor:
Sharma Photography

Task:
Confirm photographer arrival time

Assigned to:
Rahul

Due:
15 October
```

This allows:

```text
Wedding
 └── Vendor
      └── Task
```

or:

```text
Wedding
 └── Event
      └── Vendor
           └── Task
```

---

# 29. Expense Management

Expense tracking is included in V1.

The goal is simple wedding expense tracking rather than full accounting.

V1 should support:

- Expense name
- Category
- Planned amount
- Actual amount
- Payment status
- Optional event
- Notes
- Created by
- Created date

Example:

```text
Category: Photography
Planned: ₹80,000
Actual: ₹75,000
Status: Paid
Event: Wedding Ceremony
```

The dashboard can show:

- Total planned expense
- Total actual expense
- Remaining/variance amount
- Paid/unpaid summary

Advanced accounting features are not part of V1.

---

# 30. Announcements

Any Manager or Admin can create announcements.

Announcements can target:

### Entire wedding

All valid invited guests receive the announcement.

### Specific event

Only guests invited to that event receive it.

Announcements appear on the private website.

If the guest has an email address, the announcement can also be sent by email.

## Announcement expiry

Expiry is optional.

If an expiry date/time is set:

```text
Published
   ↓
Visible
   ↓
Expiry time
   ↓
No longer visible to guests
```

If no expiry is configured, it remains visible.

---

# 31. Live Streaming

V1 does not build its own video streaming infrastructure.

The platform embeds an external streaming provider, such as YouTube.

Family member workflow:

```text
Create Event
    ↓
Get external livestream URL
    ↓
Paste URL
    ↓
Attach to Event
    ↓
Guests watch
```

## Stream management

Admin and Managers can:

- Add stream URL
- Change stream URL
- Remove stream URL

## Stream access

Livestream access is **event-level**.

Only guests invited to that event can watch.

---

# 32. Livestream Recording

After the livestream ends, the external provider retains the recording.

The platform retains the recording link.

Guests can later see:

> Watch Recording

V1 does not store video recordings inside the platform.

---

# 33. Photo Gallery

The wedding has a private photo gallery.

Family members and guests with valid wedding access can upload photos.

Photos can be associated with an event.

## Photo upload flow

```text
Camera / Gallery
      ↓
Select photos
      ↓
Current event preselected
      ↓
Optionally change event
      ↓
Add optional caption
      ↓
Upload
      ↓
Validation / Processing
      ↓
Publish
```

---

# 34. Photo Upload Limits

V1 limits:

- Maximum 10 photos per upload
- Maximum 10 MB per photo
- JPG
- PNG
- WEBP

Video uploads are not supported in V1.

Backend validation must enforce these limits.

---

# 35. Photo Visibility

Any guest with valid wedding access can view the **entire wedding photo gallery**, including photos from different wedding events.

This is different from event information.

### Event information

Event-level access.

### Photos

Wedding-level gallery access.

---

# 36. Photo Publishing

Photos are published immediately after validation and processing.

There is no manual approval workflow.

---

# 37. Photo Permissions

| Action | Admin | Manager | Guest |
|---|---:|---:|---:|
| Upload | ✅ | ✅ | ✅ |
| View | ✅ | ✅ | ✅ |
| Download | ✅ | ✅ | ✅ |
| Delete | ✅ | ❌ | ❌ |

Only the **Admin** can delete photos.

V1 does not include photo reporting.

---

# 38. Photo Captions

Users can optionally add a caption.

Example:

> “Haldi ceremony with cousins ❤️”

Captions can be edited.

Photo tagging and mentions are not supported in V1.

---

# 39. Photo Uploader

Each photo displays the uploader's name.

Example:

> Uploaded by Rahul

This applies to both family members and guests.

---

# 40. Photo Downloads

Users can download:

### Individual photo

Original uploaded quality.

### All photos

The system provides a ZIP containing original photos.

V1 does not require us to define the underlying ZIP-generation infrastructure at the PRD stage.

---

# 41. Wedding Dashboard

The dashboard is the family's central workspace.

V1 dashboard displays:

- Wedding countdown
- Upcoming events
- Pending tasks
- RSVP summary
- Vendor summary
- Expense summary
- Website status
- Recent announcements
- Recent photos
- Recent family activity

Advanced analytics are excluded.

---

# 42. Family Activity Feed

The dashboard displays important recent activity.

Examples:

> Rahul added a photography vendor.

> Neha completed “Book Caterer.”

> Amit published a Sangeet announcement.

> Priya uploaded photos.

V1 does not provide a detailed audit-history interface.

---

# 43. Family Notifications

Important family collaboration actions can trigger email notifications.

Examples:

- Task assigned
- Task due date changed
- Task assignment changed
- Important event details changed

V1 does not require an in-app notification center.

---

# 44. Task Reminders

Assigned family members receive an automatic email reminder **24 hours before a task's due date**.

Only the assigned member receives the reminder.

No custom reminder configuration is required in V1.

---

# 45. Mobile Experience

V1 is a fully responsive web application.

Supported:

- Mobile
- Tablet
- Desktop

No native mobile application is required.

No PWA is required for V1.

The primary guest journey is:

```text
WhatsApp / QR
      ↓
Invitation URL
      ↓
Mobile Browser
      ↓
Private Wedding Website
```

---

# 46. Mobile Photo Experience

Guests can:

- Take photos using their phone camera
- Select existing photos from their gallery

The same upload limits apply.

---

# 47. Post-Wedding Archive

After the wedding, the wedding enters **Archive Mode**.

The purpose is to preserve wedding memories rather than continue normal planning indefinitely.

Archived content includes:

- Wedding information
- Events
- Photos
- Recorded livestream links
- Website
- Announcements
- Historical planning information

Archived wedding data is retained indefinitely in V1.

---

# 48. V1 Feature Summary

| Module | V1 |
|---|---|
| Wedding management | ✅ |
| Multiple events | ✅ |
| Admin | ✅ |
| Managers | ✅ |
| Guest accounts | ❌ |
| Guest roles | ❌ |
| Unique invitations | ✅ |
| QR invitations | ✅ |
| Event-level guest access | ✅ |
| RSVP | ✅ |
| Tasks | ✅ |
| Task assignment | ✅ |
| Vendors | ✅ |
| Vendor-task linking | ✅ |
| Expenses | ✅ |
| Private wedding website | ✅ |
| Website templates | ✅ |
| Website preview | ✅ |
| Website publishing | ✅ |
| Website unpublishing | ✅ |
| English/Hindi | ✅ |
| Announcements | ✅ |
| Email notifications | ✅ |
| External livestream | ✅ |
| Livestream recordings | ✅ |
| Photo uploads | ✅ |
| Photo gallery | ✅ |
| Photo captions | ✅ |
| Photo downloads | ✅ |
| Bulk ZIP download | ✅ |
| Photo reactions | ❌ |
| Photo comments | ❌ |
| Photo reporting | ❌ |
| Video uploads | ❌ |
| Accommodation | ❌ |
| Transportation | ❌ |
| Wishes | ❌ |
| Native mobile app | ❌ |
| Full website builder | ❌ |
| Custom domains | ❌ |
| Advanced analytics | ❌ |

---

# 49. Core Guest Journey

```text
Receive Invitation
       ↓
Open Unique Link / Scan QR
       ↓
Access Private Wedding
       ↓
View Permitted Events
       ↓
RSVP
       ↓
Receive Event Reminder
       ↓
Attend Wedding
       ↓
Watch Livestream if applicable
       ↓
Upload Photos
       ↓
View Wedding Gallery
       ↓
Download Photos
       ↓
Watch Recording Later
```

No account creation is required.

---

# 50. Core Family Journey

```text
Create Account
      ↓
Create Wedding
      ↓
Become Admin
      ↓
Invite Managers
      ↓
Create Events
      ↓
Add Guests
      ↓
Generate Invitations
      ↓
Create Tasks
      ↓
Add Vendors
      ↓
Track Expenses
      ↓
Create Website
      ↓
Preview
      ↓
Publish
      ↓
Manage Wedding Day
      ↓
Collect Photos
      ↓
Archive
```

---

# 51. Key Business Rules

1. A wedding must have an overall wedding date.
2. A wedding can contain multiple events.
3. Event dates are required.
4. Event times are optional.
5. Event venues can differ from the overall wedding location.
6. Guests do not create accounts.
7. Guests have no application role.
8. Guest access uses unique invitation links/QR codes.
9. Guest invitations expire after the wedding.
10. Family can revoke invitations.
11. Guests see only events they are invited to.
12. Valid wedding guests can view the complete wedding photo gallery.
13. Guests and family can upload photos.
14. Only Admin can delete photos.
15. Photos are published immediately after validation.
16. Maximum 10 photos per upload.
17. Maximum 10 MB per photo.
18. V1 supports JPG, PNG and WEBP.
19. Video upload is not supported.
20. Event deletion never permanently destroys event data.
21. Wedding website is private.
22. Website requires invitation access for guests.
23. Any Manager can manage/publish the website.
24. Only Admin performs protected administrative actions.
25. Livestreams are event-specific.
26. Livestreams use external providers.
27. Livestream recordings remain external.
28. Announcements can target the entire wedding or a specific event.
29. Announcement expiry is optional.
30. Critical event changes trigger email notifications.
31. Guest event reminders are sent 24 hours before an event.
32. Non-responding guests receive one RSVP reminder.
33. Assigned family members receive task reminders 24 hours before due date.
34. Wedding enters Archive Mode after completion.
35. Archived wedding information is retained indefinitely in V1.

---

# 52. Security & Privacy Requirements

Because this product handles private wedding information and personal guest data, security is a core requirement.

V1 should ensure:

- Invitation tokens are cryptographically secure.
- Invitation tokens cannot be predictable.
- Revoked invitations immediately lose access.
- Expired invitations cannot access the wedding.
- Guests cannot access uninvited event information.
- Guests cannot access family-management APIs.
- Admin-only APIs enforce server-side authorization.
- Managers cannot execute Admin-only operations.
- File upload limits are enforced server-side.
- Uploaded files are validated.
- Private photos are not exposed through publicly guessable URLs.
- Sensitive guest information is not exposed unnecessarily.
- Authentication tokens are short-lived where appropriate.
- Authorization is enforced on every protected API.
- Rate limiting is applied to sensitive endpoints.
- Audit logging should be considered for critical administrative operations.

Client-side permission checks are not sufficient. Authorization must be enforced by the backend.

---

# 53. V1 Success Criteria

The V1 product should allow a family to complete the following without external spreadsheets for the core workflow:

### Planning

- Create a wedding.
- Add multiple events.
- Assign tasks.
- Track task status.
- Add vendors.
- Track basic expenses.

### Guest management

- Create guest groups.
- Add individual guests.
- Assign guests to events.
- Generate unique invitation links.
- Generate QR codes.
- Track RSVP.

### Guest experience

- Open invitation without creating an account.
- View permitted wedding information.
- RSVP.
- Receive relevant notifications.
- Watch permitted livestream.
- Upload photos.
- View photos.
- Download original photos.

### Website

- Select template.
- Add wedding content.
- Preview website.
- Publish website.
- Unpublish website.

### Wedding memories

- Collect guest/family photos.
- Keep livestream recording links.
- Preserve wedding information after the wedding.

---

# 54. V1 Explicitly Deferred

The following should not be added during initial implementation unless a critical product requirement emerges:

- Accommodation management
- Transportation management
- Seating management
- Meal preferences
- WhatsApp API integration
- Native mobile apps
- PWA
- Custom domains
- Full website builder
- Website drag-and-drop editor
- Photo comments
- Photo likes/reactions
- Photo tagging
- Photo moderation AI
- Video uploads
- Own livestream infrastructure
- Advanced vendor marketplace
- Vendor payments/contracts
- Advanced accounting
- Advanced analytics
- Complex permission systems
- Public wedding search
- Public wedding directory

---

# 55. Product Principle for V1

The product should not attempt to solve every wedding problem.

The V1 should focus on one strong experience:

> **Create the wedding → collaborate with family → plan events → invite guests → manage the wedding → share the experience → preserve the memories.**

Every proposed feature should be evaluated against this principle before being added to V1.

---

# 56. Next Product Development Phase

The PRD is now the **source of truth for V1**.

The next phase should be **technical design**, not coding immediately.

Recommended sequence:

```text
PRD
 ↓
Domain Model
 ↓
System Architecture
 ↓
Authentication & Authorization Design
 ↓
Database Design
 ↓
API Design
 ↓
Storage & Media Architecture
 ↓
Background Jobs
 ↓
Email Architecture
 ↓
WebSocket Requirements
 ↓
Security Design
 ↓
Deployment Architecture
 ↓
Implementation Plan
 ↓
Development
```

The technical design should specifically answer:

- PostgreSQL vs MongoDB responsibilities
- Redis usage
- Object storage for photos
- Invitation-token architecture
- Admin/Manager authorization
- Guest access model
- Email system
- Background processing
- ZIP generation
- Image processing
- Livestream embedding
- WebSocket requirements
- API structure
- Database indexes and constraints
- Security boundaries
- Deployment and CI/CD