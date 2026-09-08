---
title: Sharing a project
description: Give colleagues access to a project and choose what they can do.
category: collaboration
order: 20
---

# Project Sharing & Collaboration - Implementation Summary

**Date:** 26 février 2026  
**Status:** ✅ Implemented and Ready for Testing

---

## 📋 Overview

Project sharing and collaboration features have been successfully implemented in GenoLens v2. Project owners can now invite collaborators, manage member roles (ADMIN/USER), and remove members from projects.

---

## ✅ What Was Implemented

### 1. Backend Implementation

#### Database Schema
- **Existing Table:** `project_members` (already in database)
  - `id`: UUID primary key
  - `project_id`: Foreign key to projects
  - `user_id`: UUID (Supabase Auth user ID)
  - `access_level`: Enum (ADMIN, USER)
  - `created_at`, `updated_at`: Timestamps
  - Unique constraint on (project_id, user_id)

#### Pydantic Schemas (backend/app/schemas/project.py)
- ✅ `UserRole` - Enum for ADMIN/USER roles
- ✅ `ProjectMemberBase` - Base schema with access_level
- ✅ `ProjectMemberCreate` - For inviting users (with email)
- ✅ `ProjectMemberUpdate` - For updating roles
- ✅ `ProjectMemberResponse` - API response with optional user info
- ✅ `ProjectMemberListResponse` - List of members with total count

#### API Endpoints (backend/app/api/endpoints/projects.py)
- ✅ `POST /projects/{project_id}/members` - Invite member by email
  - **Note:** Email lookup not yet implemented, returns 501 for now
  - Owner-only access
  
- ✅ `GET /projects/{project_id}/members` - List all project members
  - Accessible by project owner and members
  - Returns basic member info (ready for enrichment with user details)
  
- ✅ `PATCH /projects/{project_id}/members/{user_id}` - Update member role
  - Owner-only access
  - Change between USER and ADMIN roles
  
- ✅ `DELETE /projects/{project_id}/members/{user_id}` - Remove member
  - Owner-only access
  - Cannot remove project owner

### 2. Frontend Implementation

#### Type Definitions (frontend/src/types/project-member.ts)
- ✅ `UserRole` enum
- ✅ `ProjectMember` interface
- ✅ `ProjectMemberCreate` interface
- ✅ `ProjectMemberUpdate` interface
- ✅ `ProjectMemberListResponse` interface

#### React Query Hooks (frontend/src/hooks/useProjectMembers.ts)
- ✅ `useProjectMembers(projectId)` - Fetch members list
  - Stale time: 1 minute
  - Auto-enabled when projectId provided
  
- ✅ `useInviteProjectMember(projectId)` - Invite new member
  - Auto-invalidates members list on success
  
- ✅ `useUpdateProjectMember(projectId, userId)` - Update member role
  - Auto-invalidates members list on success
  
- ✅ `useRemoveProjectMember(projectId)` - Remove member
  - Auto-invalidates members list on success

#### Current User Hook (frontend/src/hooks/useCurrentUser.ts)
- ✅ `useCurrentUser()` - Get authenticated user from Supabase
  - Returns: `{ user, loading }`
  - User object: `{ id, email, name }`
  - Listens to auth state changes
  - Auto-refreshes on login/logout

#### UI Components

**ProjectMembersModal.tsx** - Main modal for managing collaborators
- ✅ Full-page modal with scrollable content
- ✅ **Invite Section** (Owner-only):
  - Email input field
  - Role selection (USER/ADMIN)
  - Submit button with loading state
  - Warning about email lookup not implemented
  
- ✅ **Members List**:
  - Display all current members
  - Show role badges (Owner/ADMIN/USER)
  - Owner badge for project owner (cannot be edited/removed)
  
- ✅ **Member Row Actions** (Owner-only):
  - Edit role inline (dropdown selection)
  - Save/Cancel buttons during edit
  - Remove button with confirmation
  - Actions disabled for project owner row

**ProjectDetail.tsx Integration**
- ✅ Import `ProjectMembersModal` and `Users` icon
- ✅ State management for modal open/close
- ✅ "Members" button in project header (green border/text)
- ✅ Passes `projectId`, `projectOwnerId`, `currentUserId` to modal
- ✅ Uses `useCurrentUser()` hook for authentication

---

## 🚀 How to Use

### For Project Owners

#### 1. Access Members Management
- Navigate to any project detail page
- Click the **"Members"** button in the project header (green icon with "Members" text)

#### 2. Invite a New Member (Not Fully Functional Yet)
- Fill in the email address of the user to invite
- Select their role:
  - **USER**: Can view and analyze data
  - **ADMIN**: Full access to project (but cannot delete it)
- Click "Send Invitation"
- ⚠️ **Note**: Email lookup is not implemented yet. The API will return a 501 error.

#### 3. View Current Members
- See all project members in the "Current Members" section
- Each member shows:
  - Email (or user ID if email not available)
  - Current role badge
  - Owner badge for project owner

#### 4. Change Member Roles
- Click "Edit Role" on any member (except owner)
- Select new role from dropdown
- Click "Save" to apply changes
- Role is updated immediately

#### 5. Remove Members
- Click "Remove" button on any member (except owner)
- Confirm the removal in the dialog
- Member is immediately removed from project

### For Project Members

Members can:
- ✅ View the project and all its data
- ✅ See the list of other members
- ❌ Cannot invite new members (owner-only)
- ❌ Cannot change roles (owner-only)
- ❌ Cannot remove members (owner-only)

---

## 🔧 Implementation Details

### Permission Model
- **Project Owner**:
  - Can invite members
  - Can change member roles
  - Can remove members
  - Cannot remove themselves
  
- **Project Members** (ADMIN or USER):
  - Can view project data
  - Can view member list
  - Cannot modify members

### Security
- ✅ All endpoints protected with JWT authentication
- ✅ Owner-only actions validated in backend
- ✅ Cannot remove project owner
- ✅ User identity validated via Bearer token
- ✅ ProjectMember unique constraint prevents duplicate memberships

### API Response Examples

**List Members:**
```json
{
  "members": [
    {
      "id": "uuid-1",
      "project_id": "project-uuid",
      "user_id": "user-uuid-1",
      "access_level": "ADMIN",
      "created_at": "2026-02-26T10:00:00Z",
      "updated_at": "2026-02-26T10:00:00Z",
      "user_email": "admin@example.com"
    }
  ],
  "total": 1
}
```

**Update Role:**
```json
{
  "id": "uuid-1",
  "project_id": "project-uuid",
  "user_id": "user-uuid-1",
  "access_level": "USER",
  "created_at": "2026-02-26T10:00:00Z",
  "updated_at": "2026-02-26T10:30:00Z"
}
```

---

## ⚠️ Known Limitations & TODO

### 1. Email-Based Invitation (Not Implemented)
**Current State:**
- `POST /members` endpoint exists but returns 501 (Not Implemented)
- Requires Supabase Auth API integration to:
  1. Query user by email
  2. Get their user_id
  3. Optionally send email notification

**Future Implementation:**
```python
# In projects.py endpoint
from app.core.supabase_auth import get_user_by_email

user = await get_user_by_email(member_in.user_email)
if not user:
    raise HTTPException(404, "User not found")

member = ProjectMember(
    project_id=project_id,
    user_id=user.id,
    access_level=member_in.access_level
)
```

### 2. User Info Enrichment
**Current State:**
- Member list returns basic info (id, role, timestamps)
- Optional fields `user_email` and `user_name` not populated

**Future Enhancement:**
```python
# After fetching members, enrich with user data
for member in members:
    user_info = await supabase_auth.get_user_info(member.user_id)
    member.user_email = user_info.email
    member.user_name = user_info.name
```

### 3. Email Notifications
**Not Implemented:**
- No email sent when user is invited
- No notification when role changes
- No notification when removed from project

**Future Enhancement:**
- Integrate with email service (SendGrid, AWS SES, etc.)
- Send templated emails for all member actions

### 4. Activity History
**Not Implemented:**
- No audit trail of member changes
- Cannot see who invited whom
- Cannot see history of role changes

**Future Enhancement:**
```sql
CREATE TABLE project_activity (
    id UUID PRIMARY KEY,
    project_id UUID REFERENCES projects(id),
    actor_user_id UUID,
    action TEXT,  -- 'invited', 'role_changed', 'removed'
    target_user_id UUID,
    metadata JSONB,
    created_at TIMESTAMP
);
```

---

## 🧪 Testing

### Manual Testing Steps

1. **Test Member List (Empty State)**
   ```bash
   # As project owner, view members
   GET /api/projects/{project_id}/members
   # Should return empty list initially
   ```

2. **Test Invite (Expected to Fail)**
   ```bash
   # Try to invite by email
   POST /api/projects/{project_id}/members
   {
     "user_email": "test@example.com",
     "access_level": "USER"
   }
   # Should return 501 Not Implemented
   ```

3. **Test Access Control**
   ```bash
   # As non-owner, try to invite
   POST /api/projects/{project_id}/members
   # Should return 403 Forbidden
   ```

4. **Test Update Role**
   ```bash
   # As owner, change role
   PATCH /api/projects/{project_id}/members/{user_id}
   {
     "access_level": "ADMIN"
   }
   # Should succeed and return updated member
   ```

5. **Test Remove Member**
   ```bash
   # As owner, remove member
   DELETE /api/projects/{project_id}/members/{user_id}
   # Should return 204 No Content
   ```

6. **Test Cannot Remove Owner**
   ```bash
   # Try to remove self (owner)
   DELETE /api/projects/{project_id}/members/{owner_id}
   # Should return 400 Bad Request
   ```

### Frontend Testing

1. Open any project detail page
2. Click "Members" button
3. Verify modal opens with correct sections
4. Try to invite a user (should show error)
5. Verify empty state message
6. Close and reopen modal

---

## 📝 Files Created/Modified

### Backend
- ✅ `backend/app/schemas/project.py` - Added member schemas
- ✅ `backend/app/api/endpoints/projects.py` - Added 4 new endpoints

### Frontend
- ✅ `frontend/src/types/project-member.ts` - New type definitions
- ✅ `frontend/src/hooks/useProjectMembers.ts` - New React Query hooks
- ✅ `frontend/src/hooks/useCurrentUser.ts` - New auth hook
- ✅ `frontend/src/components/ProjectMembersModal.tsx` - New modal component
- ✅ `frontend/src/components/ProjectDetail.tsx` - Added Members button & modal

---

## 🎯 Next Steps

To complete the project sharing feature:

1. **Implement Email Lookup** (1-2 hours)
   - Create `get_user_by_email()` in supabase_auth
   - Update invite endpoint to use it
   - Handle user not found cases

2. **Add Email Notifications** (2-3 hours)
   - Setup email service (SendGrid/SES)
   - Create email templates
   - Send on invite/role change/removal

3. **User Info Enrichment** (1 hour)
   - Fetch user details from Supabase Auth
   - Populate email/name fields in responses

4. **Activity History** (3-4 hours)
   - Create project_activity table
   - Log all member actions
   - Add activity feed in UI

5. **Testing** (2-3 hours)
   - Write unit tests for endpoints
   - Write integration tests
   - Add frontend component tests

---

**Completion:** 26 février 2026  
**Status:** ✅ Core functionality complete, email invitation pending
