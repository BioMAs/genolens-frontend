/**
 * ProjectMembersModal - Modal for managing project collaborators.
 * 
 * Features:
 * - List all project members with their roles
 * - Invite new members by email
 * - Change member roles (ADMIN/USER)
 * - Remove members from project
 * - Owner-only actions (invite, remove, role changes)
 */
"use client";

import { useState } from "react";
import {
  useProjectMembers,
  useInviteProjectMember,
  useUpdateProjectMember,
  useRemoveProjectMember,
} from "@/hooks/useProjectMembers";
import { UserRole, ProjectMember } from "@/types/project-member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ProjectMembersModalProps {
  projectId: string;
  projectOwnerId: string;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProjectMembersModal({
  projectId,
  projectOwnerId,
  currentUserId,
  isOpen,
  onClose,
}: ProjectMembersModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>(UserRole.USER);
  const [editingMember, setEditingMember] = useState<string | null>(null);

  const { data: membersData, isLoading } = useProjectMembers(projectId);
  const inviteMember = useInviteProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);

  const isOwner = currentUserId === projectOwnerId;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail.trim()) {
      alert("Please enter an email address");
      return;
    }

    try {
      await inviteMember.mutateAsync({
        user_email: inviteEmail,
        access_level: inviteRole,
      });
      setInviteEmail("");
      alert("Member invited successfully");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Failed to invite member: ${error.message}`);
      } else {
        alert("Failed to invite member");
      }
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      await removeMember.mutateAsync(userId);
      alert("Member removed successfully");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Failed to remove member: ${error.message}`);
      } else {
        alert("Failed to remove member");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Project Members</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Invite Section - Owner Only */}
          {isOwner && (
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Invite Member</h3>
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="role">Role</Label>
                  <select
                    id="role"
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 border rounded-md"
                  >
                    <option value={UserRole.USER}>User (View & Analyze)</option>
                    <option value={UserRole.ADMIN}>Admin (Full Access)</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  disabled={inviteMember.isPending}
                  className="w-full"
                >
                  {inviteMember.isPending ? "Inviting..." : "Send Invitation"}
                </Button>
              </form>

              {/* Note about email invitation */}
              <p className="text-sm text-gray-500 mt-2">
                ⚠️ Note: Email-based invitation is not yet fully implemented.
                The user must already have an account in the system.
              </p>
            </div>
          )}

          {/* Members List */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Current Members</h3>

            {isLoading ? (
              <p className="text-gray-500">Loading members...</p>
            ) : membersData && membersData.members.length > 0 ? (
              <div className="space-y-2">
                {membersData.members.map((member) => (
                  <MemberRow
                    key={member.user_id}
                    member={member}
                    projectId={projectId}
                    isOwner={isOwner}
                    projectOwnerId={projectOwnerId}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No members yet. Invite someone to collaborate!</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * MemberRow - Single member display with actions.
 */
function MemberRow({
  member,
  projectId,
  isOwner,
  projectOwnerId,
  onRemove,
}: {
  member: ProjectMember;
  projectId: string;
  isOwner: boolean;
  projectOwnerId: string;
  onRemove: (userId: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newRole, setNewRole] = useState<UserRole>(member.access_level);
  const updateMember = useUpdateProjectMember(projectId, member.user_id);

  const isProjectOwner = member.user_id === projectOwnerId;

  const handleUpdateRole = async () => {
    try {
      await updateMember.mutateAsync({ access_level: newRole });
      setIsEditing(false);
      alert("Member role updated successfully");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(`Failed to update role: ${error.message}`);
      } else {
        alert("Failed to update role");
      }
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50 dark:bg-gray-800">
      <div className="flex-1">
        <p className="font-medium">
          {member.user_email || `User ${member.user_id.slice(0, 8)}...`}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {isProjectOwner ? (
            <Badge variant="default">Owner</Badge>
          ) : isEditing ? (
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              className="px-2 py-1 text-sm border rounded"
            >
              <option value={UserRole.USER}>User</option>
              <option value={UserRole.ADMIN}>Admin</option>
            </select>
          ) : (
            <Badge variant={member.access_level === UserRole.ADMIN ? "default" : "secondary"}>
              {member.access_level}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions - Owner only, cannot edit self */}
      {isOwner && !isProjectOwner && (
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <Button
                size="sm"
                onClick={handleUpdateRole}
                disabled={updateMember.isPending}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Edit Role
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onRemove(member.user_id)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
