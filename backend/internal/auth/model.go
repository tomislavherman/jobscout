package auth

import "time"

type Claims struct {
	Sub  string `json:"sub"`
	Role string `json:"role"`
	Type string `json:"type"`
	Exp  int64  `json:"exp"`
}

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}
