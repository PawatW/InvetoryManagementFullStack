package com.inv.service;

import com.inv.dto.AuthResponse;
import com.inv.model.Staff;
import com.inv.repo.UserRepository;
import com.inv.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    public AuthResponse login(String email, String password) {
        Staff staff = userRepository.findByEmail(email);
        if (staff == null || !passwordEncoder.matches(password, staff.getPassword())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }
        if (!staff.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "บัญชีผู้ใช้นี้ถูกระงับ (Account is deactivated)");
        }

        String token = jwtUtil.generateToken(staff.getStaffId(), staff.getRole());
        return new AuthResponse(token, staff.getStaffId(), staff.getRole(), staff.getStaffName());
    }

    public AuthResponse getMe(String staffId) {
        Staff staff = userRepository.findById(staffId);
        if (staff == null || !staff.isActive()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found or deactivated");
        }
        return new AuthResponse(null, staff.getStaffId(), staff.getRole(), staff.getStaffName());
    }
}
