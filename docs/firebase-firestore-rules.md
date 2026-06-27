# Firebase Firestore Rules

Paste these rules in Firebase Console > Firestore Database > Rules.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isNonEmptyString(value, maxLength) {
      return value is string && value.size() > 0 && value.size() <= maxLength;
    }


    match /postStats/{postId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly([
        'title',
        'path',
        'slug',
        'views',
        'likes',
        'comments',
        'importedLegacyViews',
        'importedGiscusLikes',
        'importedGiscusComments',
        'createdAt',
        'updatedAt'
      ]);

      allow update: if request.resource.data.diff(resource.data).changedKeys()
        .hasOnly(['views', 'likes', 'comments', 'importedLegacyViews', 'updatedAt']);

      allow delete: if false;
    }

    match /postReactions/{postId} {
      allow read: if true;

      allow create: if request.resource.data.keys().hasOnly([
        'thumbsUp',
        'heart',
        'rocket',
        'hooray',
        'laugh',
        'confused',
        'eyes',
        'importedGiscusReactions',
        'createdAt',
        'updatedAt'
      ]);

      allow update: if request.resource.data.diff(resource.data).changedKeys()
        .hasOnly(['thumbsUp', 'heart', 'rocket', 'hooray', 'laugh', 'confused', 'eyes', 'updatedAt']);

      allow delete: if false;
    }

    // Legacy visible comments path. Keep readable temporarily so old comments remain
    // inspectable during migration, but do not allow public writes here anymore.
    match /postComments/{postId} {
      allow read: if true;
      allow create, update, delete: if false;

      match /comments/{commentId} {
        allow read: if true;
        allow create, update, delete: if false;
      }
    }

    // Publicly visible moderated comments. Admin SDK bypasses these rules, so manual
    // approval/copying from Firebase Console or an Admin SDK script can write here.
    match /approvedComments/{postId} {
      allow read: if true;
      allow create, update, delete: if false;

      match /comments/{commentId} {
        allow read: if true;
        allow create, update, delete: if false;
      }
    }

    // Public submission queue. Visitors can create a new pending comment, but cannot
    // read pending comments and cannot overwrite or delete any pending comment.
    match /pendingComments/{postId} {
      allow read: if false;
      allow create, update, delete: if false;

      match /comments/{commentId} {
        allow read: if false;
        allow create: if !exists(/databases/$(database)/documents/pendingComments/$(postId)/comments/$(commentId))
          && request.resource.data.keys().hasOnly([
            'id',
            'postSlug',
            'status',
            'name',
            'authorName',
            'authorAvatarUrl',
            'text',
            'message',
            'body',
            'source',
            'sourceCommentId',
            'importedAt',
            'createdAt',
            'updatedAt'
          ])
          && request.resource.data.postSlug == postId
          && request.resource.data.status == 'pending'
          && isNonEmptyString(request.resource.data.name, 80)
          && isNonEmptyString(request.resource.data.authorName, 80)
          && isNonEmptyString(request.resource.data.text, 1000)
          && isNonEmptyString(request.resource.data.message, 1000)
          && isNonEmptyString(request.resource.data.body, 1000)
          && request.resource.data.source == 'firebase';
        allow update, delete: if false;
      }
    }

    match /projectPosts/{postId} {
      allow read: if true;

      match /comments/{commentId} {
        allow read: if true;
      }

      match /reactionImports/{reactionId} {
        allow read: if true;
      }
    }

    match /giscusArchive/{discussionId} {
      allow read, write: if false;
    }
  }
}
```

## Moderated comment flow

Current visible comments were previously stored in Firestore at:

```txt
postComments/{postId}/comments/{commentId}
```

Run this migration once with Firebase Admin credentials before deploying the frontend rules/path switch:

```bash
pnpm migrate:approved-comments
```

That copies existing visible comments into:

```txt
approvedComments/{postId}/comments/{commentId}
```

New public submissions are written to:

```txt
pendingComments/{postId}/comments/{commentId}
```

To approve manually in Firebase Console, copy the pending comment document to the same post/comment ID under `approvedComments/{postId}/comments/{commentId}`, optionally add `approvedAt`, then delete the pending document. Public users cannot read `pendingComments` or write to `approvedComments`.

The migration script uses the Firebase Admin SDK, so these client rules do not need to permit writes to imported Giscus metadata or approved comments.
