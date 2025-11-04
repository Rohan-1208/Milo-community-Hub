# Production Database Setup Guide

## Overview
This guide will help you set up a production-ready Firestore database for your Milo Community Hub app with proper security rules, indexes, and data structure.

## 1. Database Schema

The database uses the following collections:

### Core Collections
- **users** - User profiles and settings
- **communities** - Community information and settings
- **posts** - User posts and community posts
- **comments** - Comments on posts
- **messages** - Direct messages between users
- **conversations** - Message conversations/threads

### Supporting Collections
- **joinRequests** - Requests to join private communities
- **notifications** - User notifications
- **reports** - Content and user reports

## 2. Firestore Security Rules

### Deploy Security Rules
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **milo-ff2c1**
3. Go to **Firestore Database** → **Rules**
4. Replace the existing rules with the content from `database/firestore.rules`
5. Click **Publish**

### Key Security Features
- Users can only read/write their own data
- Community moderators can moderate content
- Private communities require approval
- Message privacy is enforced
- Content reporting system

### Production Rules Template (copy/paste)

Use this production-focused template when you are ready to lock down writes to owners/moderators and enforce message privacy. Paste into the Firestore Rules editor and publish:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthed() {
      return request.auth != null;
    }

    function uid() {
      return request.auth.uid;
    }

    function isMember(communityId) {
      return isAuthed() && (
        communityId in get(/databases/$(database)/documents/users/$(uid())).data.joinedCommunities
      );
    }

    function isModerator(communityId) {
      return isAuthed() && (
        uid() in get(/databases/$(database)/documents/communities/$(communityId)).data.moderators
      );
    }

    function isCreator(communityId) {
      return isAuthed() && (
        get(/databases/$(database)/documents/communities/$(communityId)).data.createdBy == uid()
      );
    }

    // Users – manage your own doc
    match /users/{userId} {
      allow read: if isAuthed();
      allow create: if isAuthed() && uid() == userId;
      allow update, delete: if isAuthed() && uid() == userId;
    }

    // Communities – only creator/moderators can update/delete
    match /communities/{communityId} {
      allow read: if isAuthed();
      allow create: if isAuthed() && request.resource.data.createdBy == uid();
      allow update, delete: if isModerator(communityId) || isCreator(communityId);
    }

    // Posts – author writes; community membership enforced when posting
    match /posts/{postId} {
      allow read: if isAuthed();
      allow create: if isAuthed()
        && request.resource.data.userId == uid()
        && (
          !('communityId' in request.resource.data)
          || request.resource.data.communityId == null
          || isMember(request.resource.data.communityId)
          || isModerator(request.resource.data.communityId)
        );
      allow update, delete: if isAuthed()
        && (
          resource.data.userId == uid()
          || ('communityId' in resource.data && isModerator(resource.data.communityId))
        );
    }

    // Comments – author writes; moderators can manage comments in their community
    match /comments/{commentId} {
      allow read: if isAuthed();
      allow create: if isAuthed()
        && request.resource.data.userId == uid()
        && (
          let post = get(/databases/$(database)/documents/posts/$(request.resource.data.postId)).data;
          !('communityId' in post) || post.communityId == null || isMember(post.communityId) || isModerator(post.communityId)
        );
      allow update, delete: if isAuthed()
        && (
          resource.data.userId == uid()
          || (
            let post = get(/databases/$(database)/documents/posts/$(resource.data.postId)).data;
            ('communityId' in post) && isModerator(post.communityId)
          )
        );
    }

    // Messages – only sender/receiver can read/write
    match /messages/{messageId} {
      allow read: if isAuthed() && (resource.data.senderId == uid() || resource.data.receiverId == uid());
      allow create: if isAuthed() && request.resource.data.senderId == uid();
      allow update, delete: if isAuthed() && (resource.data.senderId == uid() || resource.data.receiverId == uid());
    }

    // Conversations – participants only
    match /conversations/{conversationId} {
      allow read, update, delete: if isAuthed() && (uid() in resource.data.participants);
      allow create: if isAuthed() && (uid() in request.resource.data.participants);
    }

    // Join requests – requester can read; moderators approve/reject
    match /joinRequests/{requestId} {
      allow read: if isAuthed() && (
        resource.data.userId == uid() || isModerator(resource.data.communityId)
      );
      allow create: if isAuthed() && request.resource.data.userId == uid();
      allow update, delete: if isAuthed() && isModerator(resource.data.communityId);
    }

    // Notifications – only the target user
    match /notifications/{notificationId} {
      allow read: if isAuthed() && resource.data.userId == uid();
      allow create: if isAuthed() && request.resource.data.userId == uid();
      allow update, delete: if isAuthed() && resource.data.userId == uid();
    }

    // Reports – reporter only (adjust if you add admin/mod tools)
    match /reports/{reportId} {
      allow create: if isAuthed() && request.resource.data.reporterId == uid();
      allow read, update, delete: if isAuthed() && resource.data.reporterId == uid();
    }
  }
}
```

If you’re iterating quickly during development, you can keep the permissive rules in `database/firestore.rules` and switch to this template before production.

### Create Collections & Sample Documents

You don’t need to pre-create collections; Firestore creates them on first write. To validate your setup, add one sample document per collection via **Firestore Database → Start collection**:

```jsonc
// users/{uid}
{
  "email": "jane@example.com",
  "name": "Jane Doe",
  "username": "jane",
  "avatar": "",
  "bio": "",
  "joinedCommunities": [],
  "followers": [],
  "following": [],
  "isVerified": false,
  "isPrivate": false,
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "lastSeen": "",
  "preferences": {"notifications": {"email": true, "push": true, "communityUpdates": true, "messages": true}, "privacy": {"showEmail": false, "showLocation": false, "showLastSeen": true}},
  "stats": {"postsCount": 0, "communitiesCount": 0, "followersCount": 0, "followingCount": 0}
}

// communities/{id}
{
  "name": "Photography Lovers",
  "slug": "photography-lovers",
  "description": "A place for photographers",
  "image": "",
  "banner": "",
  "category": "Art",
  "tags": ["photo", "dslr"],
  "location": "",
  "isPrivate": false,
  "isVerified": false,
  "memberCount": 0,
  "createdBy": "<uid>",
  "moderators": ["<uid>"],
  "rules": [],
  "settings": {"allowPosts": true, "allowImages": true, "allowLinks": true, "requireApproval": false, "allowMemberInvites": true},
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "lastActivity": "",
  "socialMedia": {},
  "stats": {"postsCount": 0, "membersCount": 0, "viewsCount": 0}
}

// posts/{id}
{
  "userId": "<uid>",
  "userName": "Jane Doe",
  "userAvatar": "",
  "communityId": "<communityId>",
  "communityName": "Photography Lovers",
  "content": "Hello community!",
  "images": [],
  "attachments": [],
  "tags": [],
  "mentions": [],
  "isPinned": false,
  "isAnnouncement": false,
  "isEdited": false,
  "likes": [],
  "commentsCount": 0,
  "sharesCount": 0,
  "viewsCount": 0,
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "visibility": "community",
  "status": "published",
  "moderation": {"isFlagged": false}
}

// comments/{id}
{
  "postId": "<postId>",
  "userId": "<uid>",
  "userName": "Jane Doe",
  "content": "Nice post!",
  "likes": [],
  "repliesCount": 0,
  "isEdited": false,
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "status": "published"
}

// conversations/{id}
{
  "participants": ["<uid>", "<otherUid>"],
  "isGroup": false,
  "createdBy": "<uid>",
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "settings": {"allowInvites": true, "allowMemberMessages": true, "muteNotifications": false},
  "unreadCount": {"<uid>": 0, "<otherUid>": 0}
}

// messages/{id}
{
  "senderId": "<uid>",
  "receiverId": "<otherUid>",
  "content": "Hey there!",
  "type": "text",
  "attachments": [],
  "isRead": false,
  "isDelivered": true,
  "isEdited": false,
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true},
  "status": "sent"
}

// joinRequests/{id}
{
  "communityId": "<communityId>",
  "userId": "<uid>",
  "userName": "Jane Doe",
  "status": "pending",
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true}
}

// notifications/{id}
{
  "userId": "<uid>",
  "type": "community_update",
  "title": "Welcome",
  "message": "Thanks for joining!",
  "data": {},
  "isRead": false,
  "createdAt": {"_serverTimestamp": true}
}

// reports/{id}
{
  "reporterId": "<uid>",
  "reason": "inappropriate_content",
  "description": "…",
  "status": "pending",
  "createdAt": {"_serverTimestamp": true},
  "updatedAt": {"_serverTimestamp": true}
}
```

Tip: When adding timestamps via the UI, you can leave them blank; your app writes `serverTimestamp()` automatically (see `database/service.ts`).

## 3. Database Indexes

### Required Indexes
Create these composite indexes in Firestore Console:

#### Posts Collection
1. **communityId + status + createdAt (desc)**
   - Fields: communityId (Ascending), status (Ascending), createdAt (Descending)
   - Collection: posts

2. **userId + status + createdAt (desc)**
   - Fields: userId (Ascending), status (Ascending), createdAt (Descending)
   - Collection: posts

3. **status + createdAt (desc)**
   - Fields: status (Ascending), createdAt (Descending)
   - Collection: posts

#### Comments Collection
1. **postId + status + createdAt (desc)**
   - Fields: postId (Ascending), status (Ascending), createdAt (Descending)
   - Collection: comments

#### Messages Collection
1. **conversationId + createdAt (desc)**
   - Fields: conversationId (Ascending), createdAt (Descending)
   - Collection: messages

#### Notifications Collection
1. **userId + createdAt (desc)**
   - Fields: userId (Ascending), createdAt (Descending)
   - Collection: notifications

### How to Create Indexes
1. Go to **Firestore Database** → **Indexes**
2. Click **Create Index**
3. Select the collection
4. Add the fields in the specified order
5. Set the sort order (Ascending/Descending)
6. Click **Create**

## 4. Data Migration

### Migrate Existing Data
If you have existing mock data, you can migrate it using the database service:

```typescript
import { communityService, postService } from '@/database/service';

// Migrate communities
const migrateCommunities = async () => {
  const mockCommunities = [/* your mock data */];
  for (const community of mockCommunities) {
    await communityService.createCommunity(community);
  }
};

// Migrate posts
const migratePosts = async () => {
  const mockPosts = [/* your mock data */];
  for (const post of mockPosts) {
    await postService.createPost(post);
  }
};
```

## 5. Performance Optimization

### Query Optimization
- Use pagination for large datasets
- Implement proper indexing
- Use real-time listeners sparingly
- Cache frequently accessed data

### Storage Optimization
- Compress images before upload
- Use appropriate image sizes
- Implement data archiving for old content

## 6. Monitoring and Analytics

### Set up Monitoring
1. Enable **Firebase Performance Monitoring**
2. Set up **Firebase Analytics**
3. Monitor **Firestore usage** and costs
4. Set up **alerts** for unusual activity

### Key Metrics to Track
- Database reads/writes per day
- Storage usage
- User engagement
- Error rates
- Response times

## 7. Backup and Recovery

### Automated Backups
1. Go to **Firestore Database** → **Backups**
2. Enable **Automated backups**
3. Set backup frequency (daily recommended)
4. Choose retention period

### Export/Import
- Use **Firebase CLI** for data export/import
- Regular manual exports for critical data
- Test restore procedures

## 8. Cost Optimization

### Reduce Costs
- Use pagination to limit reads
- Implement efficient queries
- Cache data locally when possible
- Monitor usage patterns
- Set up billing alerts

### Pricing Considerations
- **Reads**: $0.06 per 100,000 documents
- **Writes**: $0.18 per 100,000 documents
- **Deletes**: $0.02 per 100,000 documents
- **Storage**: $0.18 per GB per month

## 9. Testing

### Test Security Rules
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize project
firebase init firestore

# Test rules
firebase firestore:rules:test
```

### Test Database Operations
- Test all CRUD operations
- Verify security rules work correctly
- Test with different user roles
- Test error handling

## 10. Production Checklist

- [ ] Security rules deployed
- [ ] All indexes created
- [ ] Data migrated (if needed)
- [ ] Monitoring enabled
- [ ] Backups configured
- [ ] Performance optimized
- [ ] Cost monitoring set up
- [ ] Error handling implemented
- [ ] Testing completed
- [ ] Documentation updated

## 11. Common Issues and Solutions

### Issue: Query performance is slow
**Solution**: Check if proper indexes are created and queries are optimized

### Issue: Security rules blocking legitimate requests
**Solution**: Review rules and test with Firebase CLI

### Issue: High costs
**Solution**: Implement pagination and caching strategies

### Issue: Data inconsistency
**Solution**: Use transactions for related operations

## 12. Next Steps

1. **Deploy the security rules**
2. **Create the required indexes**
3. **Test the database operations**
4. **Set up monitoring**
5. **Migrate existing data**
6. **Go live!**

For any issues or questions, refer to the [Firebase Documentation](https://firebase.google.com/docs/firestore) or check the console logs for specific error messages.
