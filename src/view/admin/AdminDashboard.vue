<template>
  <section class="admin-page">
    <h1>Admin dashboard</h1>
    <p>Manage users, business listings, and outfit request reports.</p>

    <div class="admin-grid">
        <div class="admin-card">
            <h2>Users</h2>
            <p>View and manage registered accounts.</p>

            <RouterLink :to="{ name: 'admin-users' }">
                Manage users →
            </RouterLink>
        </div>

        <div class="admin-card">
            <h2>Business listings</h2>
            <p>Review products grouped by business, check reports, and delete listings.</p>
            <RouterLink :to="{ name: 'admin-listings' }">
                Manage listings →
            </RouterLink>
        </div>

        <div class="admin-card">
            <h2>Outfit request reports</h2>
            <p>Review reported outfit requests and take moderation action.</p>

            <RouterLink :to="{ name: 'admin-reports' }">
                Review request reports →
            </RouterLink>
        </div>
    </div>
  </section>
</template>

<style scoped>
.admin-page {
  color: #44213f;
  padding: 24px 0;
}

h1,
h2 {
  font-family: Georgia, serif;
  margin-bottom: 12px;
}

p {
  color: #6d6870;
  line-height: 1.6;
  margin-bottom: 24px;
}

.admin-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.admin-card {
  display: flex;
  flex-direction: column;
  padding: 28px;
  background: white;
  border: 1px solid #e5dfe3;
  border-radius: 16px;
}

.admin-card a {
  align-self: flex-start;
  margin-top: auto;
  padding: 10px 18px;
  background: #683760;
  color: white;
  border-radius: 8px;
  text-decoration: none;
}

@media (max-width: 700px) {
  .admin-grid {
    grid-template-columns: 1fr;
  }
}
</style>