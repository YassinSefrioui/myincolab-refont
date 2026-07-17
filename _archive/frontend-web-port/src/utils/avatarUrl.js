/**
 * Returns the URL to display a user's profile photo.
 * Always routes through the backend proxy so MinIO auth is handled server-side.
 */
export const getAvatarUrl = (user) => {
    if (!user?.id || !user?.profilePhotoUrl) return null
    return `/api/users/${user.id}/photo`
}
