package com.inv.config;

import com.inv.security.AuthEntryPoint;
import com.inv.security.JwtFilter;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
public class SecurityConfig {

    @Autowired
    private JwtFilter jwtFilter;

    @Autowired
    private AuthEntryPoint authEntryPoint;

    // Set CORS_ALLOWED_ORIGINS on Render to comma-separated list, e.g.:
    // https://your-app.vercel.app,https://your-app-git-branch.vercel.app
    @Value("${cors.allowed-origins:${CORS_ALLOWED_ORIGINS:http://localhost:3000}}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public AuthenticationManager authManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(allowedOrigins.split(",")));
        configuration.addAllowedMethod("*");
        configuration.addAllowedHeader("*");
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(withDefaults())
            .exceptionHandling(ex -> ex.authenticationEntryPoint(authEntryPoint))
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(request -> request

                // Auth endpoints
                .requestMatchers("/auth/login", "/auth/register").permitAll()
                .requestMatchers(HttpMethod.GET, "/auth/me").authenticated()

                // Technician
                .requestMatchers(HttpMethod.POST, "/requests").hasRole("TECHNICIAN")
                .requestMatchers(HttpMethod.GET, "/requests/ready-to-close").hasAnyRole("TECHNICIAN", "ADMIN")
                .requestMatchers(HttpMethod.PUT, "/requests/{id}/close").hasAnyRole("TECHNICIAN", "ADMIN")

                // Foreman
                .requestMatchers(HttpMethod.GET, "/requests/pending").hasRole("FOREMAN")
                .requestMatchers(HttpMethod.PUT, "/requests/{id}/approve").hasRole("FOREMAN")
                .requestMatchers(HttpMethod.PUT, "/requests/{id}/reject").hasRole("FOREMAN")

                // Shared read endpoints
                .requestMatchers(HttpMethod.GET, "/orders/confirmed").hasAnyRole("TECHNICIAN", "ADMIN", "SALES")
                .requestMatchers(HttpMethod.GET, "/orders/{orderId}/items").hasAnyRole("TECHNICIAN", "ADMIN", "FOREMAN", "SALES")
                .requestMatchers(HttpMethod.GET, "/requests/{requestId}/items").hasAnyRole("WAREHOUSE", "ADMIN", "TECHNICIAN", "FOREMAN")
                .requestMatchers(HttpMethod.GET, "/requests").hasAnyRole("ADMIN", "SALES", "TECHNICIAN", "FOREMAN", "WAREHOUSE")

                // Warehouse
                .requestMatchers(HttpMethod.POST, "/stock/in").hasRole("WAREHOUSE")
                .requestMatchers(HttpMethod.GET, "/stock/fulfill").hasRole("WAREHOUSE")
                .requestMatchers(HttpMethod.GET, "/stock/transactions").hasAnyRole("WAREHOUSE", "ADMIN")

                // Purchase orders
                .requestMatchers(HttpMethod.GET, "/purchase-orders", "/purchase-orders/*").hasAnyRole("PROCUREMENT", "WAREHOUSE")
                .requestMatchers(HttpMethod.POST, "/purchase-orders").hasAnyRole("WAREHOUSE", "PROCUREMENT")
                .requestMatchers(HttpMethod.PUT, "/purchase-orders/*/pricing").hasAnyRole("PROCUREMENT")
                .requestMatchers(HttpMethod.POST, "/purchase-orders/*/receive").hasAnyRole("WAREHOUSE")
                .requestMatchers(HttpMethod.POST, "/purchase-orders/upload-slip").hasAnyRole("PROCUREMENT", "ADMIN")

                // Sales
                .requestMatchers(HttpMethod.POST, "/orders").hasAnyRole("SALES", "ADMIN")
                .requestMatchers(HttpMethod.GET, "/orders/ready-to-close").hasRole("SALES")
                .requestMatchers(HttpMethod.PUT, "/orders/{orderId}/close").hasRole("SALES")
                .requestMatchers(HttpMethod.POST, "/customers").hasAnyRole("ADMIN", "SALES")

                // Products
                .requestMatchers(HttpMethod.POST, "/products").hasAnyRole("WAREHOUSE", "ADMIN", "PROCUREMENT")
                .requestMatchers(HttpMethod.POST, "/products/upload-image").hasAnyRole("WAREHOUSE", "ADMIN", "PROCUREMENT")

                // Categories
                .requestMatchers(HttpMethod.GET, "/categories").authenticated()

                // Suppliers
                .requestMatchers(HttpMethod.POST, "/suppliers").authenticated()

                // Admin
                .requestMatchers("/staff/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET, "/staff").hasRole("ADMIN")
                .requestMatchers(HttpMethod.POST, "/staff").hasRole("ADMIN")

                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
