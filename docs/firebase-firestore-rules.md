# Firebase Firestore Rules

Paste these rules in Firebase Console > Firestore Database > Rules.

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

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

    match /postComments/{postId} {
      allow read: if true;
      allow create, update, delete: if false;

      match /comments/{commentId} {
        allow read: if true;

        allow create: if request.resource.data.keys().hasOnly([
          'id',
          'postSlug',
          'name',
          'authorName',
          'authorAvatarUrl',
          'message',
          'body',
          'source',
          'sourceCommentId',
          'importedAt',
          'createdAt',
          'updatedAt'
        ])
        && request.resource.data.name is string
        && request.resource.data.message is string
        && request.resource.data.source == 'firebase'
        && request.resource.data.name.size() <= 80
        && request.resource.data.message.size() <= 1000;

        allow update, delete: if false;
      }
    }

    match /giscusArchive/{discussionId} {
      allow read, write: if false;
    }
  }
}
```

The migration script uses the Firebase Admin SDK, so these client rules do not need to permit writes to imported Giscus metadata.
